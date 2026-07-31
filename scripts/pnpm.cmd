@echo off
set "NODE_EXE=C:\Users\cytech\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "PNPM_CLI=C:\Users\cytech\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs"
set "PATH=C:\Users\cytech\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"

if not exist "%NODE_EXE%" (
  echo Bundled Node.js was not found at "%NODE_EXE%".
  echo Install Node.js from https://nodejs.org or run this from Codex.
  exit /b 1
)

if not exist "%PNPM_CLI%" (
  echo Bundled pnpm was not found at "%PNPM_CLI%".
  echo Install pnpm or run this from Codex.
  exit /b 1
)

"%NODE_EXE%" "%PNPM_CLI%" %*
