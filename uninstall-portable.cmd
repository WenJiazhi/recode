@echo off
setlocal
set "PORTABLE_ROOT=%~dp0"
if "%PORTABLE_ROOT:~-1%"=="\" set "PORTABLE_ROOT=%PORTABLE_ROOT:~0,-1%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = [IO.Path]::GetFullPath('%PORTABLE_ROOT%');" ^
  "$userPath = [Environment]::GetEnvironmentVariable('Path', 'User');" ^
  "$parts = @();" ^
  "if ($userPath) { $parts = $userPath -split ';' | Where-Object { $_ -and $_.Trim() -ne '' -and $_ -ne $root } };" ^
  "[Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User');" ^
  "Write-Host ('Removed portable recode PATH entry: ' + $root)"

echo.
echo Portable PATH entry removed.
endlocal
