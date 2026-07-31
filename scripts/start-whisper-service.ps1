$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)
python -m uvicorn services.whisper_service:app --host 127.0.0.1 --port 8001
