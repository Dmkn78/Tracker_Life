#!/usr/bin/env python3
"""Check the mobile interface and APK through the same public URLs as a phone."""

import argparse
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

MAX_METADATA_BYTES = 64 * 1024
MAX_APK_BYTES = 100 * 1024 * 1024
REQUEST_TIMEOUT_SECONDS = 120
MOBILE_ENTRY = "/mobile-app/index.html"


class MobileAssets(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.paths: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        reference = None
        if tag == "script":
            reference = attributes.get("src")
        elif tag == "link":
            reference = attributes.get("href")
        if reference and reference.startswith("/mobile-app/assets/"):
            self.paths.add(reference)


def read_public_file(origin: str, path: str, maximum_bytes: int) -> bytes:
    address = origin + path
    request = Request(address, headers={"Cache-Control": "no-cache", "User-Agent": "Life-Regime-Deployment-Check"})
    with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        if response.status != 200 or response.geturl() != address:
            raise ValueError(f"Unexpected response or redirect: {path}")
        contents = response.read(maximum_bytes + 1)
    if not contents or len(contents) > maximum_bytes:
        raise ValueError(f"Empty or oversized response: {path}")
    return contents


def read_public_json(origin: str, path: str) -> dict:
    payload = json.loads(read_public_file(origin, path, MAX_METADATA_BYTES))
    if not isinstance(payload, dict):
        raise ValueError(f"Invalid JSON object: {path}")
    return payload


def verify_mobile_publication(origin: str, expected_version: str | None = None, require_apk: bool = False) -> dict:
    address = urlsplit(origin)
    if (address.scheme not in {"http", "https"} or not address.netloc
            or address.username or address.password or address.path not in {"", "/"}
            or address.query or address.fragment):
        raise ValueError("Use the site's HTTP(S) origin without a path or credentials")
    origin = origin.rstrip("/")
    interface = read_public_json(origin, "/mobile-app/release.json")
    version = interface.get("version")
    minimum_build = interface.get("minNativeBuild")
    if (interface.get("schema") != 1 or interface.get("entry") != MOBILE_ENTRY
            or not isinstance(version, str) or not re.fullmatch(r"[A-Za-z0-9._-]{1,128}", version)
            or type(minimum_build) is not int or minimum_build < 8):
        raise ValueError("Invalid mobile interface manifest")
    if expected_version and version != expected_version:
        raise ValueError("The served mobile interface is not the expected build")
    website = read_public_json(origin, "/api/app-version")
    if website.get("version") != version:
        raise ValueError("The running website and mobile interface have different build IDs")
    assets = MobileAssets()
    assets.feed(read_public_file(origin, MOBILE_ENTRY, MAX_METADATA_BYTES).decode("utf-8"))
    if (not any(path.endswith(".js") for path in assets.paths)
            or not any(path.endswith(".css") for path in assets.paths)):
        raise ValueError("The mobile entry does not include its JavaScript and CSS")
    for path in sorted(assets.paths):
        contents = read_public_file(origin, path, MAX_APK_BYTES)
        if contents.lstrip().lower().startswith((b"<!doctype html", b"<html")):
            raise ValueError(f"A mobile asset returned an HTML page: {path}")
    publication = read_public_json(origin, "/api/mobile-update")
    if "release" not in publication:
        raise ValueError("Missing Android release field")
    release = publication["release"]
    if release is None:
        if require_apk:
            raise ValueError("The server has no published APK")
    else:
        if not isinstance(release, dict):
            raise ValueError("Invalid Android release")
        digest, size, code = release.get("sha256"), release.get("size"), release.get("versionCode")
        if (not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest)
                or type(size) is not int or not 1 <= size <= MAX_APK_BYTES
                or type(code) is not int or not minimum_build <= code <= 2_147_483_647
                or not isinstance(release.get("version"), str)
                or not re.fullmatch(r"\d+\.\d+\.\d+", release["version"])
                or release.get("apkPath") != f"/api/mobile-update/apk/{digest}"):
            raise ValueError("Invalid APK manifest or APK incompatible with the mobile interface")
        apk = read_public_file(origin, release["apkPath"], size)
        if len(apk) != size or hashlib.sha256(apk).hexdigest() != digest:
            raise ValueError("The downloaded APK does not match its size and SHA256")
    result = {
        "origin": origin, "interfaceVersion": version, "assetsVerified": len(assets.paths),
        "androidVersion": release["version"] if release else None,
        "androidVersionCode": release["versionCode"] if release else None,
    }
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("origin")
    parser.add_argument("--expected-version")
    parser.add_argument("--require-apk", action="store_true")
    options = parser.parse_args()
    try:
        result = verify_mobile_publication(options.origin, options.expected_version, options.require_apk)
        print(json.dumps(result))
        return 0
    except (ValueError, OSError) as error:
        print(f"Mobile publication check failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
