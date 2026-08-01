$ErrorActionPreference = "Stop"

$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$ApiDirectory = Join-Path $RepositoryRoot "interface_API"
$ApiPython = Join-Path $ApiDirectory ".venv\Scripts\python.exe"
if (-not (Test-Path $ApiPython)) {
  $ApiPython = "python"
}

Push-Location $ApiDirectory
try {
  & $ApiPython -m unittest discover -s tests -v
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Pop-Location
}
