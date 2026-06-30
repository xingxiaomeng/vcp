@echo off
setlocal
chcp 65001 >nul
echo ==========================================
echo   VCP Backend Launcher (PM2)
echo ==========================================
echo.
set "PATH=%~dp0runtimes\node;%~dp0runtimes\git\cmd;%~dp0runtimes\python;%~dp0runtimes\python\Scripts;%PATH%"
cd /d "%~dp0VCPToolBox"
if not exist "server.js" (
echo [VCP] server.js not found. Please check VCPToolBox installation.
pause
exit /b 1
)
echo [VCP] Cleaning old processes...
CALL pm2 delete vcp-main 2>nul
CALL pm2 delete vcp-admin 2>nul
CALL pm2 delete server 2>nul
echo.
echo [VCP] Starting main service (vcp-main)...
CALL pm2 start server.js --name "vcp-main" --no-autorestart --max-memory-restart 1500M --kill-timeout 15000
echo [VCP] Waiting for initialization (8s)...
ping -n 9 127.0.0.1 >nul
echo.
echo [VCP] Starting admin panel (vcp-admin)...
CALL pm2 start adminServer.js --name "vcp-admin" --no-autorestart --max-memory-restart 512M --kill-timeout 5000
echo.
echo ==========================================
echo   VCP Backend Started
echo ==========================================
echo.
CALL pm2 list
echo.
echo Commands:
echo   pm2 list              View process status
echo   pm2 logs              View realtime logs
echo   pm2 restart vcp-main  Restart main service
echo   pm2 stop all          Stop all services
echo.
pause
