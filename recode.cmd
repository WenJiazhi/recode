@echo off
setlocal
set "ROOT=%~dp0"
if exist "%ROOT%runtime\" (
  set "PATH=%ROOT%runtime;%ROOT%runtime\git\cmd;%ROOT%runtime\git\bin;%ROOT%runtime\git\usr\bin;%PATH%"
  if exist "%ROOT%runtime\bun.exe" if not exist "%ROOT%runtime\node.exe" powershell -NoProfile -ExecutionPolicy Bypass -Command "$bun=[IO.Path]::GetFullPath('%ROOT%runtime\\bun.exe'); $node=[IO.Path]::GetFullPath('%ROOT%runtime\\node.exe'); if (-not (Test-Path $node)) { try { New-Item -ItemType HardLink -Path $node -Target $bun -ErrorAction Stop | Out-Null } catch { Copy-Item -LiteralPath $bun -Destination $node -Force } }" >nul 2>nul
)
set "BUN=%ROOT%runtime\bun.exe"
if not exist "%BUN%" set "BUN=bun"
if exist "%ROOT%src\entrypoints\cli.tsx" (
  "%BUN%" run --feature TRANSCRIPT_CLASSIFIER "%ROOT%src\entrypoints\cli.tsx" %*
) else (
  "%BUN%" "%ROOT%dist\cli.js" %*
)
