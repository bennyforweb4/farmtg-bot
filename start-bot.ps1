$nodeExe  = "C:\Users\benny\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$script   = "C:\Users\benny\Documents\Codex\2026-06-19\66-154-109-189-root-71ob44ls5y\farmtg-local\farmtg\server\auto-loop.mjs"
$workDir  = "C:\Users\benny\Documents\Codex\2026-06-19\66-154-109-189-root-71ob44ls5y\farmtg-local\farmtg\server"
$logDir   = "C:\Users\benny\Documents\Codex\2026-06-19\66-154-109-189-root-71ob44ls5y\logs"

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

$outLog = "$logDir\farmtg-out.log"
$errLog = "$logDir\farmtg-error.log"

# 已有实例则先停掉
$old = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    (Get-WmiObject Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine -like "*auto-loop*"
}
if ($old) { $old | Stop-Process -Force; Write-Host "已停止旧实例" }

$proc = Start-Process -FilePath $nodeExe `
    -ArgumentList "`"$script`"" `
    -WorkingDirectory $workDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError  $errLog `
    -PassThru

Write-Host "FarmTG bot 已在后台启动，PID=$($proc.Id)"
Write-Host "日志: $logDir"
