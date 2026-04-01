@echo off
setlocal
set "ROOT=%~dp0"
set "CFG=%ROOT%.recode\local-provider.json"
set "EXAMPLE=%ROOT%.recode\local-provider.example.json"
set "KEY=%ROOT%.recode\api-key.txt"
if not exist "%ROOT%.recode" mkdir "%ROOT%.recode"
if not exist "%CFG%" if exist "%EXAMPLE%" copy /Y "%EXAMPLE%" "%CFG%" >nul
if not exist "%KEY%" type nul > "%KEY%"
start "" notepad "%CFG%"
start "" notepad "%KEY%"
echo Opened provider config and API key files.
endlocal
