$ErrorActionPreference = "Stop"

param(
  [string]$Name = "init"
)

Set-Location (Split-Path -Parent $PSScriptRoot)
& "$PSScriptRoot\pnpm.ps1" prisma:migrate --name $Name
