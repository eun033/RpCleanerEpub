#!/bin/sh
set -eu
task_source=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
task_target="$HOME/local-gpt-subscription-bridge"
command -v apk >/dev/null 2>&1 || { echo '이 설치기는 iSH의 Alpine Linux 전용입니다.'; exit 1; }
if [ ! -f "$HOME/repositories.gpt-bridge.bak" ]; then
  cp -- /etc/apk/repositories "$HOME/repositories.gpt-bridge.bak"
fi
printf '%s\n' \
  'https://dl-cdn.alpinelinux.org/alpine/v3.22/main' \
  'https://dl-cdn.alpinelinux.org/alpine/v3.22/community' > /etc/apk/repositories
apk update
apk upgrade
apk fix
apk add bash nodejs gcc musl-dev curl unzip ca-certificates git
node -e 'if(Number(process.versions.node.split(".")[0])<22){console.error("Node.js 22 이상이 필요합니다.");process.exit(1)}'

if [ "$task_source" != "$task_target" ]; then
  [ ! -e "$task_target" ] || { echo '이미 설치 폴더가 있습니다. 기존 계정 자료는 유지되므로 프로그램 폴더만 확인하세요.'; exit 1; }
  mkdir -m 700 -- "$task_target"
  cp -R -- "$task_source/." "$task_target/"
fi

gcc -shared -fPIC -O2 -o "$task_target/ish/ish-node-safe.so" "$task_target/ish/ish-node-safe.c" -ldl
mkdir -p -- "$task_target/node_modules"

install_package() {
  task_name=$1 task_version=$2 task_sha=$3
  task_archive=$(mktemp) task_temp=$(mktemp -d)
  curl -fL --retry 3 -o "$task_archive" "https://registry.npmjs.org/$task_name/-/$task_name-$task_version.tgz"
  [ "$(sha256sum "$task_archive" | awk '{print $1}')" = "$task_sha" ] || { rm -f -- "$task_archive"; rm -rf -- "$task_temp"; echo "$task_name 무결성 확인에 실패했습니다."; exit 1; }
  tar -xzf "$task_archive" -C "$task_temp"
  [ -f "$task_temp/package/package.json" ] || { rm -f -- "$task_archive"; rm -rf -- "$task_temp"; echo "$task_name 압축을 확인하지 못했습니다."; exit 1; }
  rm -rf -- "$task_target/node_modules/$task_name"
  mv -- "$task_temp/package" "$task_target/node_modules/$task_name"
  rm -f -- "$task_archive"
  rm -rf -- "$task_temp"
}

install_package node-fetch 2.7.0 a70348669b01db602faf140e984e61b01c4380f9b4bf5e460b7960902412832b
install_package whatwg-url 5.0.0 b09dc471f573a876eeac3902b8c1da62af5cdbbca2c6fba4a06f119f89cb7ed3
install_package tr46 0.0.3 164ae1eb32cea353551bbc7f9358dcaae4ffabbe65ec37a92ca464a9570a2a0a
install_package webidl-conversions 3.0.1 e4dfc34b40947c2cf0038cd95fa6de21f4dac93224a7ad8e169205f5c2e22da8

if git -C "$task_source" rev-parse --show-toplevel >/dev/null 2>&1; then
  printf '%s\n' "$task_source" > "$task_target/.git-source"
fi
chmod 700 -- "$task_target" "$task_target/start-ish.sh"
LD_PRELOAD="$task_target/ish/ish-node-safe.so" node --no-opt --no-maglev --no-experimental-fetch --require "$task_target/ish/fetch.cjs" -e 'if(typeof fetch!=="function")process.exit(1)'
exec sh "$task_target/start-ish.sh"
