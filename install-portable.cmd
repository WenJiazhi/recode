@echo off
setlocal
set "PORTABLE_ROOT=%~dp0"
if "%PORTABLE_ROOT:~-1%"=="\" set "PORTABLE_ROOT=%PORTABLE_ROOT:~0,-1%"
set "GIT_CMD=%PORTABLE_ROOT%\runtime\git\cmd"
set "GIT_BIN=%PORTABLE_ROOT%\runtime\git\bin"
set "GIT_USR_BIN=%PORTABLE_ROOT%\runtime\git\usr\bin"
set "RUNTIME_DIR=%PORTABLE_ROOT%\runtime"
if not exist "%RUNTIME_DIR%\bun.exe" (
  echo Portable runtime is incomplete. Missing "%RUNTIME_DIR%\bun.exe".
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = [IO.Path]::GetFullPath('%PORTABLE_ROOT%');" ^
  "$runtime = [IO.Path]::GetFullPath('%RUNTIME_DIR%');" ^
  "$gitCmd = [IO.Path]::GetFullPath('%GIT_CMD%');" ^
  "$gitBin = [IO.Path]::GetFullPath('%GIT_BIN%');" ^
  "$gitUsrBin = [IO.Path]::GetFullPath('%GIT_USR_BIN%');" ^
  "$userPath = [Environment]::GetEnvironmentVariable('Path', 'User');" ^
  "$parts = @();" ^
  "if ($userPath) { $parts = $userPath -split ';' | Where-Object { $_ -and $_.Trim() -ne '' } };" ^
  "$desired = @($root, $runtime, $gitCmd, $gitBin, $gitUsrBin);" ^
  "foreach ($entry in $desired) { if ($parts -notcontains $entry) { $parts += $entry } };" ^
  "[Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User');" ^
  "$env:Path = ($parts -join ';') + ';' + [Environment]::GetEnvironmentVariable('Path', 'Machine');" ^
  "Write-Host ('Portable recode registered in user PATH: ' + ($desired -join ';'))"

echo.
echo You can now run:
echo   recode
echo.
echo If this terminal was already open, open a new terminal to pick up the PATH change.
endlocal
