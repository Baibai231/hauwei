$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPath = Join-Path $ProjectRoot '.venv'

Write-Host 'ScholarFlow setup' -ForegroundColor Cyan
foreach ($Tool in @('python', 'npm')) {
    if (-not (Get-Command $Tool -ErrorAction SilentlyContinue)) {
        throw "$Tool is required and must be available on PATH."
    }
}
if (-not (Test-Path -LiteralPath $VenvPath)) {
    python -m venv $VenvPath
    if ($LASTEXITCODE -ne 0) { throw 'Virtual environment creation failed.' }
}

$PythonExe = Join-Path $VenvPath 'Scripts\python.exe'
if (-not (Test-Path -LiteralPath $PythonExe)) {
    throw 'The virtual environment is incomplete. Repair .venv before running setup again.'
}
& $PythonExe -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw 'pip upgrade failed.' }
& $PythonExe -m pip install -r (Join-Path $ProjectRoot 'backend\requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }

Push-Location (Join-Path $ProjectRoot 'frontend')
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
} finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot '.env'))) {
    Copy-Item -LiteralPath (Join-Path $ProjectRoot '.env.example') -Destination (Join-Path $ProjectRoot '.env')
}
Write-Host 'Setup complete. Run .\start.ps1' -ForegroundColor Green
