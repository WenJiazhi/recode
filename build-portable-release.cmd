@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-portable-release.ps1" %*
endlocal
