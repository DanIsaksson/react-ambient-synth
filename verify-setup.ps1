# verify-setup.ps1
Write-Host "=== WASM DSP Environment Verification ===" -ForegroundColor Cyan

$checks = @(
    @{ Name = "rustc"; Cmd = "rustc --version" },
    @{ Name = "cargo"; Cmd = "cargo --version" },
    @{ Name = "wasm-pack"; Cmd = "wasm-pack --version" },
    @{ Name = "wasm-opt"; Cmd = "wasm-opt --version" },
    @{ Name = "twiggy"; Cmd = "twiggy --version" }
)

$allPassed = $true

foreach ($check in $checks) {
    Write-Host -NoNewline "Checking $($check.Name)... "
    try {
        Invoke-Expression $check.Cmd | Out-Null
        Write-Host "OK" -ForegroundColor Green
    } catch {
        Write-Host "FAIL" -ForegroundColor Red
        $allPassed = $false
    }
}

# Check wasm32 target
Write-Host -NoNewline "Checking wasm32 target... "
$targets = rustup target list --installed
if ($targets -match "wasm32-unknown-unknown") {
    Write-Host "OK" -ForegroundColor Green
} else {
    Write-Host "FAIL" -ForegroundColor Red
    $allPassed = $false
}

if ($allPassed) {
    Write-Host "`n=== All checks passed! ===" -ForegroundColor Green
} else {
    Write-Host "`n=== Some checks failed ===" -ForegroundColor Red
    exit 1
}
