@echo off
cd /d "%~dp0.."
call "%~dp0pnpm.cmd" prisma:generate
