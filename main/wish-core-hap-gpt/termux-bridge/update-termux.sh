#!/usr/bin/env bash
set -euo pipefail
task_source=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
task_target="$HOME/local-gpt-subscription-bridge"
[[ -d "$task_target" ]] || { echo '먼저 install-termux.sh로 설치하세요.'; exit 1; }
for item in package.json src start.sh LICENSE README.md; do
  rm -rf -- "$task_target/$item"
  cp -R -- "$task_source/$item" "$task_target/$item"
done
chmod 700 -- "$task_target" "$task_target/start.sh"
echo '프로그램 파일을 갱신했습니다. 계정·pair·작업 기록은 유지했습니다.'
