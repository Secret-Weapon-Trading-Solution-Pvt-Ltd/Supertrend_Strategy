# SWTS Dev Starter — runs Backend + Frontend simultaneously
Write-Host "Starting SWTS..." -ForegroundColor Cyan

# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\Backend'; uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

# Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\Frontend'; npx vite"

Write-Host ""
Write-Host "Backend  -> http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend -> http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Both windows opened. Press any key to exit this window." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
