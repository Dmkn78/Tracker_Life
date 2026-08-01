$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)
$RepositoryRoot = Get-Location
$ApiDirectory = Join-Path $RepositoryRoot "interface_API"
$ApiPython = Join-Path $ApiDirectory ".venv\Scripts\python.exe"
if (-not (Test-Path $ApiPython)) {
  $ApiPython = "python"
}

try {
  Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health | Out-Null
} catch {
  Start-Process -WindowStyle Hidden -FilePath $ApiPython -ArgumentList "run.py" -WorkingDirectory $ApiDirectory
  Start-Sleep -Seconds 4
  try {
    Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health | Out-Null
  } catch {
    throw "FastAPI failed to start on http://127.0.0.1:8000. Check interface_API dependencies and DATABASE_URL."
  }
}

try {
  Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/health | Out-Null
} catch {
  Start-Process -WindowStyle Hidden -FilePath "python" -ArgumentList "-m","uvicorn","services.whisper_service:app","--host","127.0.0.1","--port","8001" -WorkingDirectory $RepositoryRoot
  Start-Sleep -Seconds 4
}

$NextCmd = Join-Path $RepositoryRoot "node_modules\.bin\next.CMD"
if (Test-Path $NextCmd) {
  & $NextCmd dev
} else {
  & "$PSScriptRoot\pnpm.ps1" dev
}
