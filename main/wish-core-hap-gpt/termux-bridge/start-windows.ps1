$ErrorActionPreference = 'Stop'
$BridgeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js 22 이상을 먼저 설치해 주세요.'
}

$Major = [int]((& node -p "process.versions.node.split('.')[0]").Trim())
if ($Major -lt 22) {
  Write-Error 'Node.js 22 이상이 필요합니다.'
}

& node (Join-Path $BridgeRoot 'src/start.mjs')
exit $LASTEXITCODE
