# Audio Engine Dual-Build Script (AVX2 & AVX-512)
$RootDir = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $RootDir)
$VcpkgRoot = if ($env:VCPKG_ROOT) { $env:VCPKG_ROOT } else { Join-Path $RepoRoot "vcpkg" }

$VcpkgBase = Join-Path $VcpkgRoot "installed\x64-windows-static-md"
if (!(Test-Path (Join-Path $VcpkgBase "lib\soxr.lib"))) {
    Write-Host ">>> Info: static-md not found. Falling back to x64-windows-static." -ForegroundColor Yellow
    $VcpkgBase = Join-Path $VcpkgRoot "installed\x64-windows-static"
}

$PkgconfDir = Join-Path $VcpkgBase "tools\pkgconf"
$PkgconfShim = Join-Path $PSScriptRoot "pkgconf-shim"
New-Item -ItemType Directory -Force -Path $PkgconfShim | Out-Null
Copy-Item (Join-Path $PkgconfDir "pkgconf.exe") (Join-Path $PkgconfShim "pkg-config.exe") -Force
Copy-Item (Join-Path $PkgconfDir "pkgconf.exe") (Join-Path $PkgconfShim "pkgconf.exe") -Force

$env:PATH = "$PkgconfShim;$PkgconfDir;$env:PATH"
$env:PKG_CONFIG = Join-Path $PkgconfShim "pkg-config.exe"
$env:PKG_CONFIG_PATH = "$(Join-Path $VcpkgBase 'lib\pkgconfig');$(Join-Path $RootDir 'pkgconfig')"
$env:VCPKG_ROOT = $VcpkgRoot
if ($VcpkgBase -match "static-md") {
    $env:VCPKG_DEFAULT_TRIPLET = "x64-windows-static-md"
} else {
    $env:VCPKG_DEFAULT_TRIPLET = "x64-windows-static"
}

# Directory Setup
$RootDir = Get-Location
$OutputDir = Join-Path (Split-Path $RootDir -Parent) "audio_engine"
if (!(Test-Path $OutputDir)) { 
    Write-Host "Creating output directory: $OutputDir"
    New-Item -ItemType Directory -Path $OutputDir 
}

# --- 1. Build AVX2 Version ---
Write-Host ">>> Building AVX2 Version (x86-64-v3)..." -ForegroundColor Cyan
# IMPORTANT: Use target-specific RUSTFLAGS to avoid crashing build-scripts on host
$env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_RUSTFLAGS = "-C target-cpu=x86-64-v3"
cargo build --release --bin audio_server --target x86_64-pc-windows-msvc
if ($LASTEXITCODE -eq 0) {
    if (Test-Path "target/x86_64-pc-windows-msvc/release/audio_server.exe") {
        Move-Item -Path "target/x86_64-pc-windows-msvc/release/audio_server.exe" -Destination (Join-Path $OutputDir "audio_server.exe") -Force
        Write-Host ">>> AVX2 build SUCCESSFUL." -ForegroundColor Green
    } else {
        Write-Host ">>> ERROR: Binary not found in expected target directory." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ">>> AVX2 build FAILED." -ForegroundColor Red
    exit 1
}

# --- 2. Build AVX-512 Version ---
Write-Host "`n>>> Building AVX-512 Version (x86-64-v4)..." -ForegroundColor Cyan
# IMPORTANT: This ensures build-scripts run on host (no AVX-512), while target EXE uses AVX-512
$env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_RUSTFLAGS = "-C target-cpu=x86-64-v4"
cargo build --release --bin audio_server --target x86_64-pc-windows-msvc
if ($LASTEXITCODE -eq 0) {
    if (Test-Path "target/x86_64-pc-windows-msvc/release/audio_server.exe") {
        Move-Item -Path "target/x86_64-pc-windows-msvc/release/audio_server.exe" -Destination (Join-Path $OutputDir "audio_server_avx512.exe") -Force
        Write-Host ">>> AVX-512 build SUCCESSFUL." -ForegroundColor Green
    } else {
        Write-Host ">>> ERROR: Binary not found in expected target directory." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ">>> AVX-512 build FAILED." -ForegroundColor Red
    exit 1
}

# Cleanup env
$env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_RUSTFLAGS = ""

Write-Host "`n[DONE] All outputs exported to: $OutputDir" -ForegroundColor Green
Write-Host "  - audio_server.exe (AVX2-Ready)"
Write-Host "  - audio_server_avx512.exe (AVX-512-Ready)"
