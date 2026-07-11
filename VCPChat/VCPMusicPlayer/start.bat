@echo off
cd /d "%~dp0"
if not exist "node_modules\electron" (
    echo Installing dependencies...
    call npm install
)
echo Starting VCP Music Player (dev mode)...
call npx electron main.js
