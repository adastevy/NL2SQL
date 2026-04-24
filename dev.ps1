# NL2SQL 一键并行启动脚本（Windows PowerShell）
# 分别在两个新窗口启动后端（uvicorn）和前端（vite）

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

if (-not (Test-Path (Join-Path $backend ".venv"))) {
    Write-Host "[dev] 后端虚拟环境不存在，请先执行：" -ForegroundColor Yellow
    Write-Host "  cd backend; python -m venv .venv; .venv\Scripts\Activate.ps1; pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    Write-Host "[dev] 前端依赖未安装，请先执行：cd frontend; npm install" -ForegroundColor Yellow
    exit 1
}

Write-Host "[dev] 启动后端 uvicorn (端口 8000) ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$backend'; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 8000"
)

Start-Sleep -Seconds 2

Write-Host "[dev] 启动前端 vite (端口 5173) ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$frontend'; npm run dev"
)

Write-Host "[dev] 已在新窗口启动前后端。"
Write-Host "       后端：http://localhost:8000/docs"
Write-Host "       前端：http://localhost:5173"
