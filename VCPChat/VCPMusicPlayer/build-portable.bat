@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================
echo  VCP Music Player - Portable x64 Build
echo ========================================
echo.

if not exist "..\audio_engine\audio_server.exe" (
    echo [ERROR] audio_server.exe not found.
    echo Please run ..\编译并部署音频引擎.bat first.
    exit /b 1
)

echo [1/4] Preparing staging directory...
node scripts\prepare-staging.js
if errorlevel 1 exit /b 1

echo.
echo [2/4] Installing staging dependencies...
cd staging
call npm install --omit=dev
if errorlevel 1 exit /b 1

echo.
echo [3/4] Installing electron-builder...
call npm install --no-save electron@41.9.1 electron-builder@26.0.12
if errorlevel 1 exit /b 1

echo.
echo [4/4] Building portable executable...
call npx electron-builder --config ..\electron-builder.config.js --win portable --x64
set BUILD_EXIT=!errorlevel!
cd ..

if !BUILD_EXIT! neq 0 (
    echo.
    echo [ERROR] Build failed.
    exit /b !BUILD_EXIT!
)

echo.
echo ========================================
echo  Build complete!
echo  Output: VCPMusicPlayer\dist\
echo ========================================
dir /b dist\*.exe 2>nul
echo.
exit /b 0
