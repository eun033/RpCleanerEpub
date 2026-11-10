#!/usr/bin/env bash
set -euo pipefail
task_source=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
task_target="$HOME/local-gpt-subscription-bridge"
command -v node >/dev/null 2>&1 || { echo '먼저 pkg install nodejs-lts 를 실행하세요.'; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<22){console.error("Node.js 22 이상이 필요합니다.");process.exit(1)}'
if [[ "$task_source" == "$task_target" ]]; then
  exec bash "$task_target/start.sh"
fi
if [[ -e "$task_target" ]]; then
  echo '이미 설치 폴더가 있습니다. 기존 파일을 덮어쓰지 않았습니다.'
  echo '기존 서버 실행: bash ~/local-gpt-subscription-bridge/start.sh'
  exit 1
fi
mkdir -m 700 -- "$task_target"
cp -R -- "$task_source/." "$task_target/"
if command -v git >/dev/null 2>&1 && git -C "$task_source" rev-parse --show-toplevel >/dev/null 2>&1; then
  printf '%s\n' "$task_source" > "$task_target/.git-source"
fi
exec bash "$task_target/start.sh"
