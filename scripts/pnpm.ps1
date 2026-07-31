$ErrorActionPreference = "Stop"

$NodeExe = "C:\Users\cytech\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$PnpmCli = "C:\Users\cytech\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs"

if (!(Test-Path $NodeExe)) {
  throw "Bundled Node.js was not found at $NodeExe. Install Node.js from https://nodejs.org or run this from Codex."
}

if (!(Test-Path $PnpmCli)) {
  throw "Bundled pnpm was not found at $PnpmCli. Install pnpm or run this from Codex."
}

$env:Path = "C:\Users\cytech\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;" + $env:Path
& $NodeExe $PnpmCli @args
