<#
.SYNOPSIS
    Runs the Sports Department Management System locally: installs backend
    dependencies if needed, starts the API server, serves the static front
    end, and opens it in your browser.

.DESCRIPTION
    - Backend runs on http://localhost:8000
    - Front end is served on http://localhost:5500
    - Press Ctrl+C to stop both servers.
#>

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'backend'

Write-Host "== Sports Department Management System ==" -ForegroundColor Cyan

# --- Node.js check ---
try {
    $nodeVersion = node -v
} catch {
    Write-Host "Node.js was not found on PATH. Install Node.js 22.5+ from https://nodejs.org and re-run this script." -ForegroundColor Red
    exit 1
}
Write-Host "Node.js version: $nodeVersion"

# --- Backend setup ---
Push-Location $backend

if (-not (Test-Path (Join-Path $backend 'node_modules'))) {
    Write-Host "Installing backend dependencies (npm install)..." -ForegroundColor Yellow
    npm install
}

$envFile = Join-Path $backend '.env'
$envExample = Join-Path $backend '.env.example'
if (-not (Test-Path $envFile)) {
    Write-Host "Creating backend/.env from .env.example..." -ForegroundColor Yellow
    Copy-Item $envExample $envFile
}

Pop-Location

# --- Free ports 8000 / 5500 if something is already listening (e.g. a previous run) ---
foreach ($port in 8000, 5500) {
    $existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $existing) {
        try { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
    }
}

# --- Start backend (new window so its logs are visible and it keeps running independently) ---
Write-Host "Starting backend on http://localhost:8000 ..." -ForegroundColor Green
$backendProc = Start-Process -PassThru -WindowStyle Normal -WorkingDirectory $backend `
    -FilePath "cmd.exe" -ArgumentList "/k", "title Sports Backend (port 8000) && node src/server.js"

# Wait for the backend to actually respond before starting the front end
$backendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        Invoke-WebRequest -Uri "http://localhost:8000/api/facilities" -UseBasicParsing -TimeoutSec 2 | Out-Null
        $backendReady = $true
        break
    } catch { }
}
if (-not $backendReady) {
    Write-Host "Backend did not respond after 30s - check the backend window for errors." -ForegroundColor Red
}

# --- Start static front-end server (new window) ---
Write-Host "Starting front end on http://localhost:5500 ..." -ForegroundColor Green
$frontendProc = Start-Process -PassThru -WindowStyle Normal -WorkingDirectory $root `
    -FilePath "cmd.exe" -ArgumentList "/k", "title Sports Frontend (port 5500) && npx --yes serve -l 5500 ."

Start-Sleep -Seconds 2

# --- Open in browser ---
Start-Process "http://localhost:5500/project/index.html"

Write-Host ""
Write-Host "Both servers are running in their own windows." -ForegroundColor Cyan
Write-Host "  Backend:   http://localhost:8000 (PID $($backendProc.Id))"
Write-Host "  Front end: http://localhost:5500 (PID $($frontendProc.Id))"
Write-Host ""
Write-Host "Demo logins (password: password123):"
Write-Host "  admin@sports.edu / officer@sports.edu / student@sports.edu"
Write-Host ""
Write-Host "Close the two opened terminal windows (or press Ctrl+C here then close them) to stop the servers."
