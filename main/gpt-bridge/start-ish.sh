#!/bin/sh
set -eu
task_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
task_shim="$task_dir/ish/ish-node-safe.so"
task_fetch="$task_dir/ish/fetch.cjs"
[ -f "$task_shim" ] && [ -f "$task_fetch" ] && [ -d "$task_dir/node_modules/node-fetch" ] || {
  echo '먼저 새 공개 gpt-bridge 폴더에서 sh install-ish.sh를 실행하세요.'
  exit 1
}
cd -- "$task_dir"
export GPT_BRIDGE_ISH=1
export LD_PRELOAD="$task_shim${LD_PRELOAD:+:$LD_PRELOAD}"
exec node --no-opt --no-maglev --no-experimental-fetch --require "$task_fetch" src/start.mjs
