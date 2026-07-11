@echo off
rem Do NOT use setlocal here — this script is called and must export env vars to the caller.

rem Configure vcpkg + pkg-config for Rust audio engine builds (Windows x64).

set "SCRIPT_DIR=%~dp0"
set "ENGINE_DIR=%SCRIPT_DIR%.."
for %%I in ("%ENGINE_DIR%") do set "ENGINE_DIR=%%~fI"

rem Resolve vcpkg root: repo sibling vcpkg\ or VCPKG_ROOT env.
if defined VCPKG_ROOT (
    set "VCPKG_ROOT=%VCPKG_ROOT:\=/%"
    set "VCPKG_ROOT=%VCPKG_ROOT:/=\%"
) else (
    for %%I in ("%ENGINE_DIR%\..\..\vcpkg") do set "VCPKG_ROOT=%%~fI"
)

if not exist "%VCPKG_ROOT%\vcpkg.exe" (
    echo [VCP][ERROR] vcpkg not found at "%VCPKG_ROOT%".
    echo [VCP][ERROR] Set VCPKG_ROOT or place vcpkg next to the repo root.
    exit /b 1
)

rem Prefer static-md (ships pkgconf + soxr); fall back to static.
set "VCPKG_TRIPLET=x64-windows-static-md"
set "VCPKG_PREFIX=%VCPKG_ROOT%\installed\%VCPKG_TRIPLET%"
if not exist "%VCPKG_PREFIX%\lib\soxr.lib" (
    set "VCPKG_TRIPLET=x64-windows-static"
    set "VCPKG_PREFIX=%VCPKG_ROOT%\installed\%VCPKG_TRIPLET%"
)

if not exist "%VCPKG_PREFIX%\lib\soxr.lib" (
    echo [VCP][ERROR] soxr.lib not found. Install with:
    echo   "%VCPKG_ROOT%\vcpkg.exe" install soxr:x64-windows-static-md pkgconf:x64-windows-static-md
    exit /b 1
)

set "PKGCONF_EXE="
if exist "%VCPKG_PREFIX%\tools\pkgconf\pkgconf.exe" (
    set "PKGCONF_EXE=%VCPKG_PREFIX%\tools\pkgconf\pkgconf.exe"
) else if exist "%VCPKG_ROOT%\downloads\tools\msys2\3e71d1f8e22ab23f\mingw64\bin\pkgconf.exe" (
    set "PKGCONF_EXE=%VCPKG_ROOT%\downloads\tools\msys2\3e71d1f8e22ab23f\mingw64\bin\pkgconf.exe"
)

if not defined PKGCONF_EXE (
    echo [VCP][ERROR] pkgconf.exe not found. Install with:
    echo   "%VCPKG_ROOT%\vcpkg.exe" install pkgconf:%VCPKG_TRIPLET%
    exit /b 1
)

rem pkg-config crate tries "pkg-config" first; provide a shim directory on PATH.
set "PKGCONF_SHIM=%ENGINE_DIR%\scripts\pkgconf-shim"
if not exist "%PKGCONF_SHIM%" mkdir "%PKGCONF_SHIM%"
copy /Y "%PKGCONF_EXE%" "%PKGCONF_SHIM%\pkg-config.exe" >nul
copy /Y "%PKGCONF_EXE%" "%PKGCONF_SHIM%\pkgconf.exe" >nul

set "PATH=%PKGCONF_SHIM%;%VCPKG_PREFIX%\tools\pkgconf;%PATH%"
set "PKG_CONFIG=%PKGCONF_SHIM%\pkg-config.exe"
set "PKG_CONFIG_PATH=%VCPKG_PREFIX%\lib\pkgconfig;%ENGINE_DIR%\pkgconfig"
set "VCPKG_ROOT=%VCPKG_ROOT%"
set "VCPKG_DEFAULT_TRIPLET=%VCPKG_TRIPLET%"
set "RUSTFLAGS=-C target-cpu=native"

rem Regenerate soxr.pc with the active triplet (avoids Windows D: prefix parsing bug).
> "%ENGINE_DIR%\pkgconfig\soxr.pc" (
    echo prefix=${pcfiledir}/../../../vcpkg/installed/%VCPKG_TRIPLET%
    echo exec_prefix=${prefix}
    echo libdir=${prefix}/lib
    echo includedir=${prefix}/include
    echo.
    echo Name: soxr
    echo Description: High quality sample-rate conversion library
    echo Version: 0.1.3
    echo Libs: -L${libdir} -lsoxr
    echo Cflags: -I${includedir}
)
copy /Y "%ENGINE_DIR%\pkgconfig\soxr.pc" "%ENGINE_DIR%\soxr.pc" >nul

echo [VCP] vcpkg root: %VCPKG_ROOT%
echo [VCP] triplet:    %VCPKG_TRIPLET%
echo [VCP] pkgconf:    %PKGCONF_EXE%
echo [VCP] soxr.lib:   %VCPKG_PREFIX%\lib\soxr.lib

rem Verify pkg-config can resolve soxr before cargo runs.
"%PKGCONF_SHIM%\pkg-config.exe" --libs --cflags soxr >nul 2>&1
if errorlevel 1 (
    echo [VCP][ERROR] pkg-config cannot resolve soxr. Output:
    "%PKGCONF_SHIM%\pkg-config.exe" --libs --cflags soxr
    exit /b 1
)

exit /b 0
