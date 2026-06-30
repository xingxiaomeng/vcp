@echo off
setlocal
chcp 65001 >nul
echo ==========================================
echo   VCP Start All (VChat + Desktop)
echo ==========================================
echo.
set "PATH=%~dp0..\runtimes\node;%~dp0..\runtimes\git\cmd;%~dp0..\runtimes\python;%~dp0..\runtimes\python\Scripts;%PATH%"
cd /d "%~dp0"
if exist "NativeSplash.exe" (
echo [VCP] Launching splash screen...
START "" "NativeSplash.exe"
)
echo [VCP] Starting VChat main window...
START "" /MIN cmd /c "cd /d "%~dp0" && npx electron ."
echo [VCP] Waiting for VChat ready signal...
set /a waited=0
:WAIT_LOOP
if exist ".vcp_ready" goto READY
if %waited% GEQ 60 goto TIMEOUT
ping -n 2 127.0.0.1 >nul
set /a waited+=1
echo [VCP] Waiting... %waited%/60s
goto WAIT_LOOP
:READY
echo [VCP] VChat is ready!
del ".vcp_ready" >nul 2>nul
ping -n 3 127.0.0.1 >nul
echo [VCP] Starting Desktop widget...
START "" /MIN cmd /c "cd /d "%~dp0" && npx electron . --desktop-only"
echo [VCP] All services started!
goto END
:TIMEOUT
echo [VCP] Warning: VChat ready signal timeout (60s). Desktop widget not started.
goto END
:END
echo.
pause
