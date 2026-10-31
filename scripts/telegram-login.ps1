$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
$Host.UI.RawUI.WindowTitle = 'Refrain: private Telegram login'
$Python = Join-Path $Root '.venv\Scripts\python.exe'

Write-Host ''
Write-Host 'REFRAIN: LOCAL TELEGRAM LOGIN' -ForegroundColor Cyan
Write-Host 'Only enter your phone, login code and optional Telegram password here.'
Write-Host 'Do not send them to the coding agent or paste them in chat.'
Write-Host ''

if (-not (Test-Path -LiteralPath $Python)) {
    throw 'The project Python environment is missing. Install dependencies from the repository root with python -m pip install -e . and run this script again.'
}

& $Python -m collector login
if ($LASTEXITCODE -eq 0) {
    Write-Host ''
    Write-Host 'Login complete. You can tell the coding agent that it succeeded.' -ForegroundColor Green
    Write-Host 'No login code or password needs to be shared.'
} else {
    Write-Host ''
    Write-Host 'Login was not completed. Read the message above before trying again.' -ForegroundColor Yellow
}
