@echo off
setlocal
set "PORTABLE_ROOT=%~dp0"
if "%PORTABLE_ROOT:~-1%"=="\" set "PORTABLE_ROOT=%PORTABLE_ROOT:~0,-1%"
set "GIT_CMD=%PORTABLE_ROOT%\runtime\git\cmd"
set "GIT_BIN=%PORTABLE_ROOT%\runtime\git\bin"
set "GIT_USR_BIN=%PORTABLE_ROOT%\runtime\git\usr\bin"
set "RUNTIME_DIR=%PORTABLE_ROOT%\runtime"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = [IO.Path]::GetFullPath('%PORTABLE_ROOT%');" ^
  "$runtime = [IO.Path]::GetFullPath('%RUNTIME_DIR%');" ^
  "$gitCmd = [IO.Path]::GetFullPath('%GIT_CMD%');" ^
  "$gitBin = [IO.Path]::GetFullPath('%GIT_BIN%');" ^
  "$gitUsrBin = [IO.Path]::GetFullPath('%GIT_USR_BIN%');" ^
  "$userPath = [Environment]::GetEnvironmentVariable('Path', 'User');" ^
  "$parts = @();" ^
  "$remove = @($root, $runtime, $gitCmd, $gitBin, $gitUsrBin);" ^
  "if ($userPath) { $parts = $userPath -split ';' | Where-Object { $_ -and $_.Trim() -ne '' -and ($_ -notin $remove) } };" ^
  "[Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User');" ^
  "Write-Host ('Removed portable recode PATH entries rooted at: ' + $root)"

echo.
echo Portable PATH entry removed.
endlocal
