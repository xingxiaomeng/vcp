@echo off
setlocal
chcp 65001 >nul
echo ==========================================
echo   VCP Frontend Launcher
echo ==========================================
echo.
set "PATH=%~dp0runtimes\node;%~dp0runtimes\git\cmd;%~dp0runtimes\python;%~dp0runtimes\python\Scripts;%PATH%"
cd /d "%~dp0VCPChat"
if not exist "package.json" (
echo [VCP] package.json not found. Please check VCPChat installation.
pause
exit /b 1
)
echo [VCP] Starting frontend client...
echo.
call npm start
pause
