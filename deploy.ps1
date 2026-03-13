# Deploy Platform Solar (backend + frontend) len Windows Server qua share (C$)
# Chay tu thu muc goc project. Can file .env.deploy (copy tu .env.deploy.example).

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

# --- Doc .env.deploy ---
$envFile = Join-Path $ProjectRoot ".env.deploy"
if (-not (Test-Path $envFile)) {
    Write-Host "Khong tim thay .env.deploy. Copy .env.deploy.example thanh .env.deploy va dien thong tin." -ForegroundColor Red
    exit 1
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $val = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
}

$hostAddr = $env:DEPLOY_HOST
$user = $env:DEPLOY_USER
$pass = $env:DEPLOY_PASSWORD
$remotePath = $env:DEPLOY_PATH

if (-not $hostAddr -or -not $user -or -not $pass -or -not $remotePath) {
    Write-Host "Thieu DEPLOY_HOST, DEPLOY_USER, DEPLOY_PASSWORD hoac DEPLOY_PATH trong .env.deploy" -ForegroundColor Red
    exit 1
}

# Chuyen C:\app\Platform_Solar -> \\host\C$\app\Platform_Solar (hoac D: -> D$ ...)
$drive = $remotePath -replace '^([A-Za-z]):.*','$1'
$pathWithoutDrive = $remotePath -replace '^[A-Za-z]:',''
$uncBase = "\\$hostAddr\${drive}`$$pathWithoutDrive"
$uncDrive = "\\$hostAddr\${drive}`$"

Write-Host "Deploy to: $uncBase" -ForegroundColor Cyan

# --- Build frontend ---
$frontendPath = Join-Path $ProjectRoot "frontend"
if (-not (Test-Path $frontendPath)) {
    Write-Host "Khong tim thay thu muc frontend." -ForegroundColor Red
    exit 1
}

Write-Host "Building frontend..." -ForegroundColor Yellow
Push-Location $frontendPath
try {
    npm ci 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { npm install 2>&1 | Out-Null }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
} finally {
    Pop-Location
}
Write-Host "Frontend build OK." -ForegroundColor Green

# --- Ket noi share (net use) ---
Write-Host "Ket noi share $hostAddr..." -ForegroundColor Yellow
net use $uncDrive /user:$user $pass 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Khong ket noi duoc share. Kiem tra user/pass, firewall (File and Printer Sharing), hoac dung share khac (vd: \\host\Deploy)." -ForegroundColor Red
    exit 1
}

try {
    # Tao thu muc tren server neu chua co
    $backendDest = Join-Path $uncBase "backend"
    $frontendDest = Join-Path $uncBase "frontend"
    $distDest = Join-Path $frontendDest "dist"

    $remoteRoot = $uncBase
    if (-not (Test-Path $remoteRoot)) {
        New-Item -ItemType Directory -Path $remoteRoot -Force | Out-Null
    }
    foreach ($d in @($backendDest, $frontendDest, $distDest)) {
        if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    }

    # Copy backend (loai tru node_modules, .env, logs)
    $backendSrc = Join-Path $ProjectRoot "backend"
    Write-Host "Copy backend..." -ForegroundColor Yellow
    robocopy $backendSrc $backendDest /MIR /XD node_modules logs /XF .env /NFL /NDL /NJH /NJS
    if ($LASTEXITCODE -ge 8) {
        Write-Host "Robocopy backend loi: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
    Write-Host "Backend copy OK." -ForegroundColor Green

    # Copy frontend dist
    $distSrc = Join-Path $ProjectRoot "frontend\dist"
    Write-Host "Copy frontend\dist..." -ForegroundColor Yellow
    robocopy $distSrc $distDest /MIR /NFL /NDL /NJH /NJS
    if ($LASTEXITCODE -ge 8) {
        Write-Host "Robocopy frontend dist loi: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
    Write-Host "Frontend dist copy OK." -ForegroundColor Green
} finally {
    net use $uncDrive /delete /y 2>&1
}

Write-Host ""
Write-Host "Deploy xong. Buoc tiep tren server:" -ForegroundColor Cyan
Write-Host "  1. Vao $remotePath\backend, chac chan co file .env (copy tu .env.example neu chua co)." -ForegroundColor White
Write-Host "  2. cd backend && npm ci && npm start   (hoac pm2 restart solarev-api neu dung PM2)." -ForegroundColor White
Write-Host "  3. Serve frontend: thu muc $remotePath\frontend\dist (IIS/Nginx/static server)." -ForegroundColor White
