@echo off
setlocal
set "ROOT=%~dp0"
set "BUN=%ROOT%runtime\bun.exe"
if not exist "%BUN%" set "BUN=bun"
if exist "%ROOT%src\entrypoints\cli.tsx" (
  "%BUN%" "%ROOT%src\entrypoints\cli.tsx" %*
) else (
  "%BUN%" "%ROOT%dist\cli.js" %*
)
