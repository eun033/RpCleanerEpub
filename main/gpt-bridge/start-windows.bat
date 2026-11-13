@echo off
setlocal DisableDelayedExpansion
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-windows.ps1"
set "bridge_exit_code=%errorlevel%"
echo.
echo GPT Bridge stopped. Press any key to finish.
pause >nul
exit /b %bridge_exit_code%
