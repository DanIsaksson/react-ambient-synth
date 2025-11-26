Write-Host "=== Building DSP Core WASM Module ===" -ForegroundColor Cyan

# Navigate to wasm directory
Push-Location $PSScriptRoot

# Project root (3 levels up from src/audio/wasm)
$projectRoot = Resolve-Path "$PSScriptRoot/../../.."

try {
    # Build with wasm-pack
    Write-Host "Building with wasm-pack..." -ForegroundColor Yellow
    F:\Programs\.cargo\bin\wasm-pack.exe build --target web --release
    if ($LASTEXITCODE -ne 0) { throw "wasm-pack build failed" }

    # Optimize with wasm-opt (optional - skip if not installed)
    if (Get-Command wasm-opt -ErrorAction SilentlyContinue) {
        Write-Host "Optimizing with wasm-opt..." -ForegroundColor Yellow
        wasm-opt pkg/dsp_core_bg.wasm -O4 -o pkg/dsp_core_bg.wasm
        if ($LASTEXITCODE -ne 0) { Write-Host "wasm-opt failed (non-fatal)" -ForegroundColor Yellow }
    } else {
        Write-Host "wasm-opt not found, skipping optimization" -ForegroundColor Yellow
    }

    # Report sizes
    Write-Host ""
    Write-Host "=== Build Complete ===" -ForegroundColor Green
    Get-Item pkg/dsp_core_bg.wasm | Select-Object Name, @{N='Size (KB)';E={[math]::Round($_.Length/1KB, 2)}}

    # =========================================================================
    # COPY TO PUBLIC DIRECTORIES
    # =========================================================================
    Write-Host ""
    Write-Host "=== Copying to public folders ===" -ForegroundColor Cyan

    # Create directories if needed
    $wasmDir = "$projectRoot/public/wasm"
    $workletsDir = "$projectRoot/public/worklets"
    
    New-Item -ItemType Directory -Force -Path $wasmDir | Out-Null
    New-Item -ItemType Directory -Force -Path $workletsDir | Out-Null

    # Copy WASM package files
    Write-Host "  -> Copying WASM package to public/wasm/" -ForegroundColor Gray
    Copy-Item -Path "pkg/dsp_core_bg.wasm" -Destination $wasmDir -Force
    Copy-Item -Path "pkg/dsp_core.js" -Destination $wasmDir -Force
    Copy-Item -Path "pkg/dsp_core.d.ts" -Destination $wasmDir -Force -ErrorAction SilentlyContinue

    # Copy worklet processor
    Write-Host "  -> Copying wasm-dsp-processor.js to public/worklets/" -ForegroundColor Gray
    $workletSource = "$PSScriptRoot/../worklets/wasm-dsp-processor.js"
    if (Test-Path $workletSource) {
        Copy-Item -Path $workletSource -Destination $workletsDir -Force
    } else {
        Write-Host "  WARNING: wasm-dsp-processor.js not found at $workletSource" -ForegroundColor Yellow
    }

    Write-Host "  Files copied successfully" -ForegroundColor Green

    # =========================================================================
    # ANALYZE SIZE (optional)
    # =========================================================================
    if (Get-Command twiggy -ErrorAction SilentlyContinue) {
        Write-Host ""
        Write-Host "=== Top 10 Size Contributors ===" -ForegroundColor Cyan
        twiggy top pkg/dsp_core_bg.wasm | Select-Object -First 15
    }

    Write-Host ""
    Write-Host "=== Integration Ready ===" -ForegroundColor Green
    Write-Host "  WASM:    /wasm/dsp_core_bg.wasm" -ForegroundColor Gray
    Write-Host "  Worklet: /worklets/wasm-dsp-processor.js" -ForegroundColor Gray

} finally {
    Pop-Location
}
