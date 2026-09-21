$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonExe = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $PythonExe)) {
    throw 'Dependencies are not installed. Run .\setup.ps1 first.'
}

$Backend = Start-Process -FilePath $PythonExe -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000' -WorkingDirectory (Join-Path $ProjectRoot 'backend') -WindowStyle Hidden -PassThru
Write-Host 'ScholarFlow backend: http://127.0.0.1:8000' -ForegroundColor Cyan
Write-Host 'ScholarFlow frontend: http://127.0.0.1:5173' -ForegroundColor Cyan
Push-Location (Join-Path $ProjectRoot 'frontend')
try {
    npm run dev
} finally {
    Pop-Location
    if (-not $Backend.HasExited) { Stop-Process -Id $Backend.Id }
}
