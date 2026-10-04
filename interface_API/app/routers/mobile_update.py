"""Public signed application artifacts; no user data or credentials are served here."""

import json
import os
import re
import hashlib
import tempfile
import threading
import time
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse

router = APIRouter(prefix="/api/mobile-update", tags=["mobile-update"])
NO_CACHE = {"Cache-Control": "no-store"}
MAX_APK_BYTES = 100 * 1024 * 1024
MAX_MANIFEST_BYTES = 16 * 1024
DOWNLOAD_LOCK = threading.Lock()


def release_directory() -> Path:
    return Path(os.environ.get("MOBILE_RELEASE_DIR", str(Path(__file__).resolve().parents[3] / ".runtime" / "mobile-release")))


def validate_release(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("Invalid manifest")
    digest = payload.get("sha256")
    version = payload.get("version")
    code = payload.get("versionCode")
    size = payload.get("size")
    if (not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest)
            or not isinstance(version, str) or not re.fullmatch(r"\d+\.\d+\.\d+", version)
            or type(code) is not int or not 1 <= code <= 2_147_483_647
            or type(size) is not int or not 1 <= size <= MAX_APK_BYTES
            or payload.get("apkPath") != f"/api/mobile-update/apk/{digest}"):
        raise ValueError("Invalid release")
    return {"version": version, "versionCode": code, "sha256": digest, "size": size,
            "apkPath": payload["apkPath"]}


def github_repository() -> str:
    repository = os.environ.get("MOBILE_GITHUB_REPOSITORY", "").strip()
    if repository and not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Invalid GitHub repository")
    return repository


def github_client() -> httpx.Client:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "Life-Regime-Updater",
               "X-GitHub-Api-Version": "2022-11-28"}
    token = os.environ.get("MOBILE_GITHUB_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return httpx.Client(headers=headers, timeout=httpx.Timeout(10, connect=5), follow_redirects=True)


def asset_url(repository: str, asset: dict) -> str:
    identifier = asset.get("id")
    if type(identifier) is not int or identifier < 1 or asset.get("state") != "uploaded":
        raise ValueError("Invalid asset")
    return f"https://api.github.com/repos/{repository}/releases/assets/{identifier}"


def read_github_release(client: httpx.Client, repository: str) -> tuple[dict, dict] | None:
    deadline = time.monotonic() + 25
    publications = []
    for page in range(1, 11):
        response = client.get(f"https://api.github.com/repos/{repository}/releases", params={"per_page": 100, "page": page})
        response.raise_for_status()
        current_page = response.json()
        if not isinstance(current_page, list) or time.monotonic() > deadline:
            raise ValueError("Invalid or slow releases response")
        publications.extend(current_page)
        if any(isinstance(publication, dict) and not publication.get("draft") and not publication.get("prerelease")
               and str(publication.get("tag_name", "")).startswith("android-v") for publication in current_page):
            break
        if len(current_page) < 100:
            return None
    else:
        raise ValueError("Too many releases to find Android publication")
    for publication in publications:
        if not isinstance(publication, dict):
            raise ValueError("Invalid publication")
        if publication.get("draft") or publication.get("prerelease") or not str(publication.get("tag_name", "")).startswith("android-v"):
            continue
        assets = publication.get("assets")
        if not isinstance(assets, list) or any(not isinstance(asset, dict) for asset in assets):
            raise ValueError("Invalid assets")
        manifest = next((asset for asset in assets if asset.get("name") == "release.json"), None)
        if manifest is None or type(manifest.get("size")) is not int or not 1 <= manifest["size"] <= MAX_MANIFEST_BYTES:
            raise ValueError("Missing manifest")
        with client.stream("GET", asset_url(repository, manifest), headers={"Accept": "application/octet-stream"}) as artifact:
            artifact.raise_for_status()
            content = bytearray()
            for chunk in artifact.iter_bytes():
                content.extend(chunk)
                if len(content) > MAX_MANIFEST_BYTES or time.monotonic() > deadline:
                    raise ValueError("Manifest too large or response too slow")
        release = validate_release(json.loads(content))
        if time.monotonic() > deadline:
            raise ValueError("Slow manifest response")
        apk = next((asset for asset in assets if asset.get("name") == f'{release["sha256"]}.apk'), None)
        if apk is None or type(apk.get("size")) is not int or apk["size"] != release["size"]:
            raise ValueError("Missing APK")
        asset_url(repository, apk)
        return release, apk
    return None


def cache_github_apk(client: httpx.Client, repository: str, release: dict, asset: dict) -> Path:
    directory = release_directory() / "github-cache"
    directory.mkdir(parents=True, exist_ok=True)
    apk = directory / f'{release["sha256"]}.apk'
    if not DOWNLOAD_LOCK.acquire(timeout=5):
        raise ValueError("Another download is in progress")
    try:
        if apk.is_file() and apk.stat().st_size == release["size"]:
            with apk.open("rb") as cached:
                if hashlib.file_digest(cached, "sha256").hexdigest() == release["sha256"]:
                    return apk
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=directory, suffix=".tmp", delete=False) as output:
                temporary = Path(output.name)
                digest = hashlib.sha256()
                received = 0
                deadline = time.monotonic() + 45
                with client.stream("GET", asset_url(repository, asset), headers={"Accept": "application/octet-stream"}) as response:
                    response.raise_for_status()
                    for chunk in response.iter_bytes():
                        received += len(chunk)
                        if received > release["size"] or time.monotonic() > deadline:
                            raise ValueError("APK too large or download too slow")
                        digest.update(chunk)
                        output.write(chunk)
                if received != release["size"] or digest.hexdigest() != release["sha256"]:
                    raise ValueError("APK integrity failure")
            temporary.replace(apk)
            return apk
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    finally:
        DOWNLOAD_LOCK.release()


@router.get("")
def get_mobile_release():
    try:
        repository = github_repository()
        if repository:
            with github_client() as client:
                publication = read_github_release(client, repository)
            return JSONResponse({"release": publication[0] if publication else None}, headers=NO_CACHE)
    except (ValueError, TypeError, KeyError, OSError, httpx.HTTPError):
        raise HTTPException(status_code=503, detail="Les mises à jour GitHub sont indisponibles. Vérifie la configuration du serveur et son accès au dépôt.")
    manifest = release_directory() / "release.json"
    if not manifest.is_file():
        return JSONResponse({"release": None}, headers=NO_CACHE)
    try:
        release = validate_release(json.loads(manifest.read_text(encoding="utf-8")))
        digest = release["sha256"]
        if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest):
            raise ValueError("Invalid hash")
        apk = release_directory() / f"{digest}.apk"
        if not apk.is_file() or apk.stat().st_size != release["size"]:
            raise ValueError("Missing artifact")
        return JSONResponse({"release": release}, headers=NO_CACHE)
    except (KeyError, ValueError, TypeError, OSError):
        raise HTTPException(status_code=503, detail="La publication Android est incomplète.")


@router.get("/apk/{digest}")
def get_mobile_apk(digest: str):
    if not re.fullmatch(r"[a-f0-9]{64}", digest):
        raise HTTPException(status_code=404, detail="APK introuvable.")
    try:
        repository = github_repository()
        if repository:
            with github_client() as client:
                publication = read_github_release(client, repository)
                if publication is None or publication[0]["sha256"] != digest:
                    raise HTTPException(status_code=404, detail="Cette version n’est plus publiée. Recherche à nouveau une mise à jour.")
                apk = cache_github_apk(client, repository, *publication)
            return FileResponse(apk, media_type="application/vnd.android.package-archive", filename="Life-Regime.apk", headers=NO_CACHE)
    except (ValueError, TypeError, KeyError, OSError, httpx.HTTPError):
        raise HTTPException(status_code=503, detail="Le téléchargement GitHub est indisponible ou incomplet. Réessaie.")
    apk = release_directory() / f"{digest}.apk"
    if not apk.is_file():
        raise HTTPException(status_code=404, detail="APK introuvable.")
    return FileResponse(apk, media_type="application/vnd.android.package-archive", filename="Life-Regime.apk", headers=NO_CACHE)
