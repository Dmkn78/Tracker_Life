"""HTTP regression tests for failures that previously looked like a healthy deploy."""

import hashlib
import importlib.util
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

spec = importlib.util.spec_from_file_location("verify_publication", Path(__file__).with_name("verify-mobile-publication.py"))
publication_check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publication_check)


class MobilePublicationTests(unittest.TestCase):
    def setUp(self) -> None:
        apk = b"signed-APK-test-fixture"
        digest = hashlib.sha256(apk).hexdigest()
        self.release = {
            "version": "1.0.8", "versionCode": 9, "sha256": digest, "size": len(apk),
            "apkPath": f"/api/mobile-update/apk/{digest}",
        }
        self.routes = {
            "/mobile-app/release.json": json.dumps({
                "schema": 1, "version": "build-current", "entry": "/mobile-app/index.html",
                "minNativeBuild": 8, "builtAt": "2026-10-04T18:55:00Z",
            }).encode(),
            "/api/app-version": b'{"version":"build-current"}',
            "/mobile-app/index.html": b'<script src="/mobile-app/assets/app.js"></script><link rel="stylesheet" href="/mobile-app/assets/app.css">',
            "/mobile-app/assets/app.js": b'console.log("mobile");',
            "/mobile-app/assets/app.css": b'body { color: black; }',
            "/api/mobile-update": json.dumps({"release": self.release}).encode(),
            self.release["apkPath"]: apk,
        }
        routes = self.routes

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                contents = routes.get(self.path)
                self.send_response(200 if contents is not None else 404)
                self.end_headers()
                self.wfile.write(contents if contents is not None else b"missing")

            def log_message(self, format: str, *args) -> None:
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def verify(self) -> dict:
        return publication_check.verify_mobile_publication(self.origin, "build-current", True)

    def test_complete_deploy_serves_matching_interface_and_apk(self) -> None:
        result = self.verify()
        self.assertEqual(result["androidVersionCode"], 9)
        self.assertEqual(result["assetsVerified"], 2)

    def test_surviving_old_web_process_is_detected(self) -> None:
        self.routes["/api/app-version"] = b'{"version":"build-old"}'
        with self.assertRaisesRegex(ValueError, "different build IDs"):
            self.verify()

    def test_missing_css_fails_even_when_index_is_healthy(self) -> None:
        del self.routes["/mobile-app/assets/app.css"]
        with self.assertRaises(OSError):
            self.verify()

    def test_login_html_instead_of_javascript_is_detected(self) -> None:
        self.routes["/mobile-app/assets/app.js"] = b"<!DOCTYPE html><html>Login</html>"
        with self.assertRaisesRegex(ValueError, "HTML page"):
            self.verify()

    def test_missing_android_route_is_detected(self) -> None:
        del self.routes["/api/mobile-update"]
        with self.assertRaises(OSError):
            self.verify()

    def test_android_manifest_without_artifact_is_detected(self) -> None:
        del self.routes[self.release["apkPath"]]
        with self.assertRaises(OSError):
            self.verify()

    def test_same_size_corrupted_apk_is_detected(self) -> None:
        self.routes[self.release["apkPath"]] = b"X" * self.release["size"]
        with self.assertRaisesRegex(ValueError, "SHA256"):
            self.verify()

    def test_apk_required_for_bootstrap(self) -> None:
        self.routes["/api/mobile-update"] = b'{"release":null}'
        with self.assertRaisesRegex(ValueError, "no published APK"):
            self.verify()
        result = publication_check.verify_mobile_publication(self.origin)
        self.assertIsNone(result["androidVersion"])

    def test_apk_too_old_for_hosted_interface_is_detected(self) -> None:
        self.release["versionCode"] = 7
        self.routes["/api/mobile-update"] = json.dumps({"release": self.release}).encode()
        with self.assertRaisesRegex(ValueError, "incompatible"):
            self.verify()


if __name__ == "__main__":
    unittest.main()
