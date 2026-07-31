$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)
try {
  Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/health | Out-Null
} catch {
  Start-Process -WindowStyle Hidden -FilePath "python" -ArgumentList "-m","uvicorn","services.whisper_service:app","--host","127.0.0.1","--port","8001" -WorkingDirectory (Get-Location)
  Start-Sleep -Seconds 4
}

$NextCmd = Join-Path (Get-Location) "node_modules\.bin\next.CMD"
if (Test-Path $NextCmd) {
  & $NextCmd dev
} else {
  & "$PSScriptRoot\pnpm.ps1" dev
}
