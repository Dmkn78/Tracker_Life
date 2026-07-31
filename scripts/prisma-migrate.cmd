@echo off
cd /d "%~dp0.."
set "MIGRATION_NAME=%~1"
if "%MIGRATION_NAME%"=="" set "MIGRATION_NAME=init"
call "%~dp0pnpm.cmd" prisma:migrate --name "%MIGRATION_NAME%"
