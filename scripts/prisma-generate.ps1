$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)
& "$PSScriptRoot\pnpm.ps1" prisma:generate
