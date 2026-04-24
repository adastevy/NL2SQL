<#
.SYNOPSIS
    NL2SQL 智能数据分析助理 · 开发环境一键启动脚本（Windows / PowerShell）

.DESCRIPTION
    在两个独立 PowerShell 窗口中并行启动后端 FastAPI (uvicorn, 8000) 和前端 Vite (5173)。
    脚本本身立刻返回，不阻塞当前终端；两个子窗口各自承载一个服务的实时日志。

.PARAMETER Backend
    仅启动后端。

.PARAMETER Frontend
    仅启动前端。

.PARAMETER UseMock
    前端以 VITE_USE_MOCK=true 启动（离线演示模式，无需后端/API Key）。

.EXAMPLE
    .\dev.ps1                # 同时启动前端 + 后端（真实模式）
    .\dev.ps1 -UseMock       # 同时启动，前端走 Mock 数据
    .\dev.ps1 -Backend       # 只启后端
    .\dev.ps1 -Frontend      # 只启前端
#>
[CmdletBinding()]
param(
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$UseMock
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

# 没指定任何开关 → 前后端都启
if (-not $Backend -and -not $Frontend) {
    $Backend = $true
    $Frontend = $true
}

function Start-BackendWindow {
    $venv = Join-Path $root 'backend\.venv\Scripts\Activate.ps1'
    if (-not (Test-Path $venv)) {
        Write-Warning "未找到 backend\.venv，自动创建并安装依赖 ..."
        Push-Location (Join-Path $root 'backend')
        try {
            python -m venv .venv
            & .\.venv\Scripts\python.exe -m pip install --upgrade pip
            & .\.venv\Scripts\pip.exe install -r requirements.txt
        } finally {
            Pop-Location
        }
    }

    $env_file = Join-Path $root 'backend\.env'
    if (-not (Test-Path $env_file)) {
        Write-Warning "未找到 backend\.env；请参考 backend\.env.example 配置 DASHSCOPE_API_KEY 后再运行真实模式。"
    }

    $cmd = @"
`$Host.UI.RawUI.WindowTitle = '[backend] uvicorn :8000'
Set-Location '$($root)\backend'
. .\.venv\Scripts\Activate.ps1
`$env:PYTHONIOENCODING = 'utf-8'
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
"@
    Write-Host "→ 启动后端窗口（uvicorn @127.0.0.1:8000）..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $cmd
}

function Start-FrontendWindow {
    $pkg = Join-Path $root 'frontend\package.json'
    if (-not (Test-Path $pkg)) {
        throw "未找到 frontend\package.json，请在项目根目录运行。"
    }
    $node_modules = Join-Path $root 'frontend\node_modules'
    if (-not (Test-Path $node_modules)) {
        Write-Warning "未找到 frontend\node_modules，自动 npm install ..."
        Push-Location (Join-Path $root 'frontend')
        try { npm install } finally { Pop-Location }
    }

    $mockFlag = if ($UseMock) { "`$env:VITE_USE_MOCK = 'true'" } else { "`$env:VITE_USE_MOCK = 'false'" }
    $titleSuffix = if ($UseMock) { 'MOCK' } else { 'REAL' }

    $cmd = @"
`$Host.UI.RawUI.WindowTitle = '[frontend] vite :5173 ($titleSuffix)'
Set-Location '$($root)\frontend'
$mockFlag
npm run dev -- --host localhost
"@
    Write-Host "→ 启动前端窗口（vite @localhost:5173, 模式=$titleSuffix）..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $cmd
}

if ($Backend) { Start-BackendWindow }
if ($Frontend) { Start-FrontendWindow }

Write-Host ""
Write-Host "已派发启动任务。" -ForegroundColor Green
Write-Host "  后端: http://127.0.0.1:8000/api/ping   docs: http://127.0.0.1:8000/docs"
Write-Host "  前端: http://localhost:5173"
Write-Host ""
Write-Host "停止服务：在对应窗口按 Ctrl+C，或直接关闭窗口。"
