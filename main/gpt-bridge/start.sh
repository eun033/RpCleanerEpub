#!/usr/bin/env bash
set -euo pipefail
task_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
command -v node >/dev/null 2>&1 || { echo '먼저 pkg install nodejs-lts 를 실행하세요.'; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<22){console.error("Node.js 22 이상이 필요합니다.");process.exit(1)}'
cd -- "$task_dir"
exec node src/start.mjs
