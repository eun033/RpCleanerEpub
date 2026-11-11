#!/usr/bin/env bash
set -euo pipefail
task_source=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
task_target="$HOME/local-gpt-subscription-bridge"
[[ -d "$task_target" ]] || { echo '먼저 install-termux.sh로 설치하세요.'; exit 1; }
if command -v git >/dev/null 2>&1 && task_repo=$(git -C "$task_source" rev-parse --show-toplevel 2>/dev/null); then
  for task_candidate in "$task_repo/gpt-brige-crack/bridge-main" "$task_repo/main/gpt-bridge"; do
    if [[ "$task_candidate" != "$task_source" && -f "$task_candidate/package.json" && -f "$task_candidate/update-termux.sh" ]]; then
      task_source="$task_candidate"
      break
    fi
  done
fi
for item in package.json version.json src start.sh start-ish.sh install-ish.sh LICENSE README.md; do
  [[ -e "$task_source/$item" ]] || continue
  rm -rf -- "$task_target/$item"
  cp -R -- "$task_source/$item" "$task_target/$item"
done
if [[ -d "$task_source/ish" ]]; then
  mkdir -p -- "$task_target/ish"
  cp -R -- "$task_source/ish/." "$task_target/ish/"
fi
if [[ "${GPT_BRIDGE_ISH:-}" == 1 ]]; then
  command -v gcc >/dev/null 2>&1 || { echo 'iSH 업데이트에 gcc가 필요합니다.'; exit 1; }
  gcc -shared -fPIC -O2 -o "$task_target/ish/ish-node-safe.so" "$task_target/ish/ish-node-safe.c" -ldl
fi
if command -v git >/dev/null 2>&1 && git -C "$task_source" rev-parse --show-toplevel >/dev/null 2>&1; then
  printf '%s\n' "$task_source" > "$task_target/.git-source"
fi
chmod 700 -- "$task_target" "$task_target/start.sh"
[[ -f "$task_target/start-ish.sh" ]] && chmod 700 -- "$task_target/start-ish.sh"
echo '프로그램 파일을 갱신했습니다. 계정·pair·작업 기록은 유지했습니다.'
