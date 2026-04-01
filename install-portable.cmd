@echo off
setlocal
set "PORTABLE_ROOT=%~dp0"
if "%PORTABLE_ROOT:~-1%"=="\" set "PORTABLE_ROOT=%PORTABLE_ROOT:~0,-1%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = [IO.Path]::GetFullPath('%PORTABLE_ROOT%');" ^
  "$userPath = [Environment]::GetEnvironmentVariable('Path', 'User');" ^
  "$parts = @();" ^
  "if ($userPath) { $parts = $userPath -split ';' | Where-Object { $_ -and $_.Trim() -ne '' } };" ^
  "if ($parts -notcontains $root) { $parts += $root; [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User') };" ^
  "$env:Path = ($parts -join ';') + ';' + [Environment]::GetEnvironmentVariable('Path', 'Machine');" ^
  "Write-Host ('Portable recode registered in user PATH: ' + $root)"

echo.
echo You can now run:
echo   recode
echo.
echo If this terminal was already open, open a new terminal to pick up the PATH change.
endlocal
