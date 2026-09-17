#!/usr/bin/env python3
"""Install the CPU-only Parakeet V3 runtime and model used by /api/transcribe."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
import venv

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
MODEL_NAME = "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8"
MODEL_URL = f"https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/{MODEL_NAME}.tar.bz2"
MODEL_SHA256 = "5793d0fd397c5778d2cf2126994d58e9d56b1be7c04d13c7a15bb1b4eafb16bf"
REQUIRED_FILES = ["encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt"]


def install_model(destination: Path) -> None:
    if all((destination / name).is_file() for name in REQUIRED_FILES):
        print(f"Parakeet V3 model already installed: {destination}")
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destination.parent) as temporary_directory:
        archive = Path(temporary_directory) / "model.tar.bz2"
        print(f"Downloading {MODEL_URL}", flush=True)
        with urllib.request.urlopen(MODEL_URL, timeout=120) as response, archive.open("wb") as output:
            shutil.copyfileobj(response, output)
        with archive.open("rb") as downloaded:
            digest = hashlib.file_digest(downloaded, "sha256").hexdigest()
        if digest != MODEL_SHA256:
            raise RuntimeError("Parakeet V3 archive checksum does not match the verified model")
        with tarfile.open(archive) as model_archive:
            model_archive.extractall(temporary_directory, filter="data")
        extracted = Path(temporary_directory) / MODEL_NAME
        if not all((extracted / name).is_file() for name in REQUIRED_FILES):
            raise RuntimeError("Downloaded archive does not contain Parakeet V3")
        if destination.exists():
            raise RuntimeError(f"Incomplete model exists at {destination}; move it aside before retrying")
        extracted.rename(destination)
        print(f"Model archive SHA256: {digest}")


def install() -> None:
    runtime = REPOSITORY_ROOT / ".runtime"
    environment = runtime / "parakeet-venv"
    python = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.exists():
        venv.EnvBuilder(with_pip=True).create(environment)
    subprocess.run([str(python), "-m", "pip", "install", "-r", str(REPOSITORY_ROOT / "services" / "requirements-parakeet.txt")], check=True)
    install_model(Path(os.environ.get("PARAKEET_MODEL_DIR", str(runtime / "models" / MODEL_NAME))))
    print("Parakeet V3 is ready for /api/transcribe.")


if __name__ == "__main__":
    install()
