@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\sync-portable.ps1" %*
exit /b %errorlevel%
