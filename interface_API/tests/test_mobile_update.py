import json
import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routers.mobile_update import router, validate_release


class MobileUpdateTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.environment = patch.dict(os.environ, {"MOBILE_RELEASE_DIR": self.directory.name, "MOBILE_GITHUB_REPOSITORY": "", "MOBILE_GITHUB_TOKEN": ""})
        self.environment.start()
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.environment.stop()
        self.directory.cleanup()

    def test_no_publication_is_not_a_fake_up_to_date_version(self):
        response = self.client.get("/api/mobile-update")
        self.assertEqual(response.json(), {"release": None})
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_manifest_and_immutable_apk_download(self):
        digest = "a" * 64
        release = {"version": "1.0.4", "versionCode": 5, "sha256": digest, "size": 3, "apkPath": f"/api/mobile-update/apk/{digest}"}
        directory = Path(self.directory.name)
        (directory / f"{digest}.apk").write_bytes(b"apk")
        (directory / "release.json").write_text(json.dumps(release), encoding="utf-8")
        self.assertEqual(self.client.get("/api/mobile-update").json()["release"], release)
        response = self.client.get(f"/api/mobile-update/apk/{digest}")
        self.assertEqual(response.content, b"apk")
        self.assertEqual(response.headers["content-type"], "application/vnd.android.package-archive")
        self.assertEqual(self.client.get("/api/mobile-update/apk/release.json").status_code, 404)
        (directory / f"{digest}.apk").unlink()
        self.assertEqual(self.client.get("/api/mobile-update").status_code, 503)

    def github_transport(self, corrupt=False):
        apk = b"signed apk fixture"
        digest = hashlib.sha256(apk).hexdigest()
        release = {"version": "1.0.8", "versionCode": 9, "sha256": digest,
                   "size": len(apk), "apkPath": f"/api/mobile-update/apk/{digest}"}
        manifest = json.dumps(release).encode()
        self.requests = []

        def respond(request):
            self.requests.append(request)
            if request.url.path.endswith("/releases"):
                return httpx.Response(200, json=[{"tag_name": "android-v1.0.8-9", "draft": False, "prerelease": False,
                    "assets": [{"id": 11, "state": "uploaded", "name": "release.json", "size": len(manifest)},
                               {"id": 12, "state": "uploaded", "name": f"{digest}.apk", "size": len(apk)}]}])
            if request.url.path.endswith("/11"):
                return httpx.Response(200, content=manifest)
            if request.url.path.endswith("/12"):
                return httpx.Response(302, headers={"Location": "https://release-assets.githubusercontent.com/apk"})
            if request.url.host == "release-assets.githubusercontent.com":
                self.assertNotIn("authorization", request.headers)
                return httpx.Response(200, content=b"corrupt" if corrupt else apk)
            return httpx.Response(404)

        transport = httpx.MockTransport(respond)
        factory = lambda: httpx.Client(transport=transport, follow_redirects=True,
            headers={"Authorization": "Bearer server-only-token"})
        return release, apk, factory

    def test_private_github_release_download_and_cache(self):
        release, apk, factory = self.github_transport()
        with patch.dict(os.environ, {"MOBILE_GITHUB_REPOSITORY": "Dmkn78/Tracker_Life"}), patch("app.routers.mobile_update.github_client", factory):
            response = self.client.get("/api/mobile-update")
            self.assertEqual(response.json(), {"release": release})
            self.assertNotIn("server-only-token", response.text)
            path = release["apkPath"]
            self.assertEqual(self.client.get(path).content, apk)
            self.assertEqual(self.client.get(path).content, apk)
            self.assertEqual(sum(request.url.path.endswith("/12") for request in self.requests), 1)
            self.assertEqual(self.client.get(f'/api/mobile-update/apk/{"b" * 64}').status_code, 404)

    def test_github_corrupt_download_is_never_served(self):
        release, _, factory = self.github_transport(corrupt=True)
        with patch.dict(os.environ, {"MOBILE_GITHUB_REPOSITORY": "Dmkn78/Tracker_Life"}), patch("app.routers.mobile_update.github_client", factory):
            self.assertEqual(self.client.get(release["apkPath"]).status_code, 503)
        self.assertEqual(list(Path(self.directory.name).rglob("*.apk")), [])
        self.assertEqual(list(Path(self.directory.name).rglob("*.tmp")), [])

    def test_github_access_failure_is_not_reported_as_up_to_date(self):
        factory = lambda: httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(404)))
        with patch.dict(os.environ, {"MOBILE_GITHUB_REPOSITORY": "Dmkn78/Tracker_Life"}), patch("app.routers.mobile_update.github_client", factory):
            self.assertEqual(self.client.get("/api/mobile-update").status_code, 503)

    def test_github_no_release_is_reported_explicitly(self):
        factory = lambda: httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(200, json=[])))
        with patch.dict(os.environ, {"MOBILE_GITHUB_REPOSITORY": "Dmkn78/Tracker_Life"}), patch("app.routers.mobile_update.github_client", factory):
            self.assertEqual(self.client.get("/api/mobile-update").json(), {"release": None})

    def test_android_release_is_found_after_a_full_page_of_other_releases(self):
        release, _, factory = self.github_transport()
        original = factory()
        visited_pages = []
        def respond(request):
            if request.url.path.endswith("/releases"):
                page = request.url.params.get("page")
                visited_pages.append(page)
                if page == "1":
                    return httpx.Response(200, json=[{"tag_name": "web-v1", "draft": False, "prerelease": False}] * 100)
            return original.send(request)
        paginated = lambda: httpx.Client(transport=httpx.MockTransport(respond))
        with patch.dict(os.environ, {"MOBILE_GITHUB_REPOSITORY": "Dmkn78/Tracker_Life"}), patch("app.routers.mobile_update.github_client", paginated):
            self.assertEqual(self.client.get("/api/mobile-update").json(), {"release": release})
        original.close()
        self.assertEqual(visited_pages, ["1", "2"])

    def test_manifest_rejects_invalid_native_versions_and_artifact_paths(self):
        release, _, _ = self.github_transport()
        for fields in ({"versionCode": True}, {"versionCode": 2_147_483_648}, {"size": True},
                       {"size": 104_857_601}, {"apkPath": "https://evil.test/app.apk"}):
            with self.subTest(fields=fields), self.assertRaises(ValueError):
                validate_release({**release, **fields})


if __name__ == "__main__":
    unittest.main()
