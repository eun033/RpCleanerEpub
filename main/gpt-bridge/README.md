# GPT 브리지 0.2.22

기기 내부의 `127.0.0.1`에서만 실행되는 Node.js 표준 라이브러리 기반 브리지다. Android Termux, Windows Git 실행용 PowerShell 감독기와 iOS iSH 설치기를 제공한다. 공식 Sign in with ChatGPT 인증과 `/v1/responses` 스트림 처리를 맡는다. HAP-gpt userscript에는 OAuth 토큰을 전달하지 않는다.

개발 작업은 [CODEX_HANDOFF.md](CODEX_HANDOFF.md), 비공개·공개 배포 준비는 [DEPLOYMENT.md](DEPLOYMENT.md)를 먼저 읽는다. 새 공개 ZIP은 HAP-gpt를 포함하지 않는 브리지 단독 묶음으로 준비한다.

## 처음 설치

Termux에서 다음을 실행한다.

```bash
pkg update
pkg install git nodejs-lts
git clone --branch wish-core-patch https://github.com/eun033/gpt-codex-work.git
cd gpt-codex-work/gpt-brige-crack/bridge-main
bash install-termux.sh
```

Node.js 22 이상이 필요하고 별도 npm 패키지는 설치하지 않는다. 설치본은 `~/local-gpt-subscription-bridge`, OAuth 인증과 작업 기록은 권한이 제한된 `~/.local-gpt-subscription-bridge`에 저장된다.

## iOS iSH 처음 설치

iSH의 Alpine 셸에서 신규 단독 공개 ZIP을 받아 설치한다. 기존 HAP-gpt 합본 주소는 이전 설치의 마이그레이션 전용이며 iSH 설치 파일을 포함하지 않는다.

```sh
apk update
apk add curl unzip
cd /root
curl -fL -o GPT_Bridge.zip https://raw.githubusercontent.com/eun033/RpCleanerEpub/main/main/gpt-bridge/GPT_Bridge.zip
unzip -o GPT_Bridge.zip
cd gpt-bridge
sh install-ish.sh
```

설치기는 기존 저장소 설정을 `/root/repositories.gpt-bridge.bak`에 보관하고 Alpine 3.22로 갱신한 뒤 Node.js 22, 컴파일 도구, ZIP·Git 도구를 설치한다. 이어 iSH에서 Node.js가 호출하는 미지원 syscall을 안전하게 처리하는 로컬 shim을 빌드한다. iSH에서 필요한 `node-fetch` 2.7.0과 세 의존성만 고정된 SHA-256으로 확인해 설치하며 Android·Windows 실행에는 추가하지 않는다.

이후 실행은 `sh ~/local-gpt-subscription-bridge/start-ish.sh`를 사용한다. 이 실행법은 감독기를 거치므로 관리 화면의 **↻ 서버**와 **ZIP 업데이트**가 동작한다. 업데이트 중에도 iSH shim과 fetch 호환 계층을 유지한다. iOS가 iSH를 백그라운드에서 중단하면 서버도 멈출 수 있으므로 iSH를 다시 열어 위 명령으로 시작한다.

## Windows Git 실행

Git과 Node.js 22 이상을 설치하고 PowerShell에서 저장소의 브리지 폴더로 이동한 뒤 실행한다.

```powershell
cd "$HOME\gpt-codex-work\gpt-brige-crack\bridge-main"
powershell -ExecutionPolicy Bypass -File .\start-windows.ps1
```

`start-windows.ps1`은 `src/start.mjs` 감독기를 실행한다. 관리 화면의 **↻ 서버**나 Git 업데이트로 서버가 종료 코드 75를 내면 같은 주소·pair·작업 기록으로 다시 실행한다. 실행 중인 `bridge-main` 폴더 자체가 Git 저장소 안에 있으면 설치 방식을 Git으로 자동 인식하며, Windows에서는 `where.exe`로 Git을 찾는다.

`node src/server.mjs`를 직접 실행해도 서버와 AI 요청은 동작하지만 자동 재시작을 맡을 감독기가 없다. 이 경우 관리 화면은 Git 설치를 감지해도 **재시작 지원 실행 필요**로 표시한다. 서버를 끈 뒤 위 PowerShell 명령으로 다시 실행한다.

## 최초 로그인과 pair 연결

1. 실행 시 표시되는 `http://127.0.0.1:17446/#pair=…` 주소 전체를 같은 폰의 브라우저에서 연다.
2. **Continue with ChatGPT**를 눌러 본인 계정과 워크스페이스로 승인한다.
3. **사용 가능한 모델 확인**을 눌러 계정별 목록을 확인한다.
4. **확장 프로그램용 연결 주소 복사**를 눌러 HAP-gpt 설정에 붙여 넣는다.

관리 화면은 시스템 다크·라이트 모드를 따르는 `서버`·`최근 작업`·`설정` 세 탭이다. 헤더는 56×24 로고·이름·서버 상태 한 줄이며 버전과 업데이트 유무는 서버 관리 카드에 따로 표시한다. 상태는 `정상`, `중지`, `오류` 등 문구로 구분한다. 요청 일시정지는 정상 서버와 구분해 서버 관리 행에 표시한다. `재시작`은 서버를 다시 실행하고 `업데이트 확인`은 설치 방식에 맞는 버전만 조회한다. 새 버전이 있을 때 해당 Git 또는 ZIP 업데이트 버튼 하나만 표시한다.

0.2.7부터 최근 작업의 접힌 항목을 54px 한 줄 목록으로 표시해 한 화면에서 더 많은 작업을 확인할 수 있다. 요청한 확프가 선택적으로 보낸 로컬 표시용 `client` 정보가 있으면 `방 이름 · 작업명`과 확프 이름을 표시한다. HAP-gpt 0.1.4가 이 정보를 보낸다. 구버전과 다른 확프처럼 정보가 없는 요청은 종전처럼 모델명만 표시한다. 표시 정보는 작업 JSON에만 저장하고 OpenAI Responses 요청 본문에는 전달하지 않는다.

ChatGPT 연결이 확인되면 계정 버튼은 **재연결**로 바뀐다. 최초 연결 직후 모델 목록을 자동으로 가져오며, **모델 확인**을 누르면 최신 목록으로 갱신한다. 성공한 모델 목록과 마지막 확인 시각은 관리 화면을 연 브라우저의 `localStorage`에 저장한다. OAuth 토큰은 브라우저에 저장하지 않는다.

연결 코드는 기본적으로 현재 브라우저 탭 세션에만 남는다. **이 브라우저에 연결 코드 저장**을 선택하면 같은 `127.0.0.1:포트` 주소의 브라우저 저장소에 보관되어 브라우저를 다시 열어도 사용할 수 있다. 공용 기기에서는 선택하지 않는다. 포트가 바뀌면 브라우저 출처도 달라지므로 새 주소에서 다시 연결한다.

공식 계정 모델 목록은 표시용 `slug`와 `display_name`만 보장한다. 추론 강도 정보가 없으면 다음 공식 모델 문서 범위를 적용한다.

- GPT-6.1 Sol·GPT-6 Astra: `낮음`부터 `최대`
- GPT-6.1 Terra·GPT-6 Sol·GPT-6 Luna·GPT-5.6 Sol·GPT-5.6 Terra·GPT-5.6 Luna: `끄기`부터 `최대`

계정 목록이 추론 강도를 직접 제공하면 그 값을 우선한다. GPT-5.6 Sol의 공식 `gpt-5.6` 별칭도 같은 범위로 처리한다.

`pair`는 OpenAI 토큰은 아니지만 이 로컬 서버를 제어하는 비밀값이다. 토큰 파일, `pair`, 연결 주소를 다른 사람·GitHub·로그·지원 문의에 공개하지 않는다.

## 대시보드 정보 구조

- 서버: 상태·재시작 행, 버전·업데이트 행, 브리지 로컬 사용량 두 행과 실제 토큰 합계를 표시한다. 설치 방식 설명은 도움말에서 연다.
- 최근 작업: 진행 중 → 완료 → 오류 순서로 묶고 한 줄 집계와 상태 확인을 제공한다. 항목을 펼치면 상태·소요 시간·실제 토큰을 먼저 보여주며, `응답 내용`과 `원본 로그`는 각각 접혀 있다. 상세 GET 결과를 재사용하며 원본 JSON은 로그를 열 때만 표시한다.
- 설정: 로컬 연결과 구독 연결을 유지하고 모델 개수만 요약한다. 모델 목록과 호출 제한을 담은 고급 설정은 기본 접힘이다.
- 업데이트 진행은 중립 색상과 스피너로 표시한다. 연결 코드와 OAuth 토큰은 역할을 구분하고 연결 코드는 기존처럼 비밀번호 입력으로 가린다.

개편 명세서는 개발 원본의 `DASHBOARD_REDESIGN_SPEC.md`를 참고한다.

## 호출량 표시

- 최근 5시간·7일 수치는 이 브리지의 저장된 작업 중 실제 AI 호출을 시작한 횟수다.
- 입력·출력·총 토큰은 완료 응답의 `usage`가 저장된 작업 전체 합계다. 완료 전에 끊기거나 구형 기록에 사용량이 없으면 합계에서 제외하고 제외 횟수를 함께 표시한다.
- 진행 막대의 최대치는 관리 화면에서 정한 로컬 보호 한도이며 ChatGPT 공식 잔여량이나 크레딧이 아니다.
- 화면 수치는 브리지의 로컬 호출량이므로 남은 공식 한도는 반드시 **공식 한도 확인**에서 확인한다. 공식 문서에는 잔여량을 브리지로 가져오는 공개 API가 없다.
- 새로고침에 성공하면 화면 수치와 마지막 갱신 시각을 브라우저에 저장한다. 작업 기록과 실제 집계 원본은 브리지의 로컬 작업 파일에 남는다.
- 0.1.x의 24시간 한도는 0.2.0에서 7일 한도로 바뀐다. 기존 최대 글자 수와 5시간 한도는 유지하고, 7일 한도는 안전한 기본값 200회로 시작한다.

## 응답 후 실제 토큰 사용량

응답이 완료되면 `response.completed`의 `usage`를 작업 기록에 저장한다. 서버 탭에는 **최근 완료 응답의 실제 토큰**과 누적 입력·출력·총 토큰을 표시한다. **최근 작업**에서 각 항목을 펼치면 해당 응답의 입력·출력·총 토큰과, 제공된 경우 캐시·추론 토큰도 확인할 수 있다. 새로고침은 저장된 기록만 읽는다.

캐시는 입력 토큰에, 추론은 출력 토큰에 이미 포함되어 있으므로 총합에 다시 더하지 않는다. 사용량 필드가 없거나 유효한 정수가 아니면 해당 항목에만 **토큰 사용량 추정 못함**을 표시하고 누적 합계에서 제외한다. 0토큰은 유효한 값이다. 사용량 확인 실패로 오류 알림을 띄우거나 정상 응답을 실패로 바꾸거나 다시 생성하지 않는다.

별도 토큰 계산 API를 호출하지 않는다. 사용량 기록은 재시작 후에도 유지되지만 ChatGPT 요금제의 공식 잔여량으로 환산하지 않는다. 횟수 제한은 유지한다.

## 시작·중지·재실행

```bash
bash ~/local-gpt-subscription-bridge/start.sh
```

- 중지: 실행 중인 Termux에서 `Ctrl+C`
- 재실행: 위 `start.sh` 명령을 다시 실행
- 관리 화면 재시작: 진행·대기 중인 AI 요청이 없을 때 **서버 재시작**을 누른다. `start.sh`가 같은 pair·계정·작업 기록으로 서버를 다시 실행한다.
- 포트 변경: `GPT_BRIDGE_PORT=18446 bash ~/local-gpt-subscription-bridge/start.sh`
- `EADDRINUSE`: 기존 서버를 중지하거나 다른 포트를 지정한다. 연결 주소도 새 포트 주소로 다시 저장한다.

0.1.0에서 0.1.1 이상으로 처음 갱신한 직후에는 기존 서버를 `Ctrl+C`로 끄고 `bash ~/local-gpt-subscription-bridge/start.sh`를 한 번 직접 실행해야 관리 화면 재시작 버튼이 활성화된다. 이후에는 버튼으로 재시작할 수 있다. 서버가 대기·진행 중인 요청을 가진 경우 데이터 안전을 위해 버튼이 비활성화된다.

## 재부팅 후 시작

가장 단순한 방법은 휴대폰 재부팅 후 Termux를 열어 `start.sh`를 실행하는 것이다. 자동 시작이 필요하면 F-Droid의 Termux:Boot를 설치하고 `~/.termux/boot/hap-gpt-bridge`에 다음을 둔다.

```bash
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
bash ~/local-gpt-subscription-bridge/start.sh >/dev/null 2>&1 &
```

```bash
chmod 700 ~/.termux/boot/hap-gpt-bridge
```

Android 배터리 최적화가 Termux를 종료하면 자동 정리가 중단될 수 있으므로 Termux의 백그라운드 실행을 허용한다.

## 업데이트

0.2.22는 헤더·서버 관리·로컬 사용량·작업 상세·기본/고급 설정의 정보 구조를 개편한다. 배경 #F8FAF9, 텍스트 #17211D, 액센트 #18835B, 12px 카드 모서리와 44px 이상 터치 영역을 적용한다. 인증·추론·저장·업데이트 API는 유지한다.

0.2.21은 대시보드 로고를 제공된 세로 릴레이 노드와 양쪽 두 점씩으로 연결된 SVG로 교체한다. 56×24 크기·테마 색상·기존 배치는 유지한다.

0.2.20은 대시보드 로고를 크랙 외곽선·중앙 노드·점선이 개선된 제공 SVG로 교체한다. 56×24 크기와 테마 색상은 유지한다.

0.2.19는 대시보드 제목 앞에 제공된 56×24 SVG 로고를 추가한다. 시스템 테마의 글자색을 따르고 좁은 화면에서는 상단 정보를 줄바꿈한다.

0.2.18은 업데이트·서버 재시작 후 고정 시간에 새로고침하던 방식을 바꾼다. 같은 연결 코드로 상태를 조회해 새 서버 실행 ID를 확인한 뒤 연결 코드를 주소 fragment에 실어 페이지를 다시 연다. 저장소가 차단된 브라우저에서는 fragment를 유지하고, 탭 저장소가 정상인 경우에는 저장을 확인한 뒤 주소에서 제거한다. 업데이트 응답이 연결 중단으로 유실돼도 업데이트를 재요청하지 않고 재연결만 확인한다.

기존 버전 화면으로 0.2.18을 받는 첫 업데이트에는 이전 새로고침 코드가 실행될 수 있다. 페이지가 열리지 않으면 서버가 다시 실행된 뒤 터미널의 `#pair=…` 포함 주소 전체를 한 번 다시 연다. 새 화면이 열린 뒤부터 이 복구 방식이 적용된다.

0.2.17은 사전 입력 계산기를 제거하고 완료 응답의 실제 입력·출력·총 토큰을 최근 응답과 각 작업에 표시한다. 사용량 확인 실패는 해당 항목의 추정 불가 문구로만 알린다.

0.2.16은 서버 탭에 공식 API 기반의 수동 입력 토큰 계산기를 추가한다. ChatGPT 구독 인증이 계산 경로를 지원하지 않을 때는 사용 불가 안내를 표시하며 완료 응답의 실제 사용량 집계는 유지한다.

0.2.15는 공개 이전 주소의 고정 HAP-gpt ZIP에 호환 업데이트를 한 번 제공한다. 기존 주소로 설치한 사용자는 관리 화면에서 평소처럼 업데이트하면 0.2.15를 받은 뒤 이후부터 신규 단독 공개 경로를 자동 확인한다. 주소 변경이나 계정·pair·작업 자료 이동은 필요 없다. 신규 `main/gpt-bridge`에만 iSH 설치·실행 파일을 제공하며 iSH 감독 실행에서도 관리 화면 재시작과 ZIP 업데이트가 유지된다.

0.2.14는 페이지 상단에 현재 실행 버전을 표시하고, 저장된 완료 응답의 입력·출력·총 토큰을 합산한다. 단독 공개 배포의 `main/gpt-bridge/version.json`과 고정 파일명 `GPT_Bridge.zip`을 읽어 현재 버전과 비교한다. 새 공개 경로가 아직 배치되지 않은 설치에서는 기존 HAP-gpt 합본 ZIP 경로를 폴백으로 확인한다.

0.2.13은 관리 페이지를 열 때 현재 설치 방식의 업데이트를 자동 확인한다. 새 버전이 있으면 `GPT 브리지` 제목 옆에 `업데이트 가능` 칩을 표시하며, 최신 상태이거나 확인에 실패하면 칩을 숨긴다.

0.2.12는 `PAYLOAD_FIELDS` 오류를 호출 프로그램과 브리지의 버전 불일치 또는 지원하지 않는 요청 필드 문제로 안내한다. 최근 작업 출처용 `client` 정보는 계속 선택 항목이며, 이를 보내지 않는 다른 확장 프로그램도 기존 요청 형식으로 사용할 수 있다.

0.2.11은 Windows ZIP 업데이트가 Termux 명령을 호출하던 문제를 고쳤다. Windows 기본 PowerShell의 .NET ZIP 기능으로 내부 경로와 버전을 검사하고 현재 실행 폴더에 적용한 뒤 Node 감독기가 서버를 다시 시작한다. Git 설치판은 `where.exe`로 Git과 실행 원본을 찾고 `git pull --ff-only` 뒤 같은 감독 재시작 경로를 사용한다. Android·macOS·Windows·WSL·미확정 값은 HAP-gpt의 작은 기기 SVG를 고르는 데도 사용한다. 요청이 멈춘 상태는 상단에 `서버 정상 · 요청 일시정지`로 표시한다.

0.2.9는 `/api/status`에 `android`·`mac`·`windows`·`unknown` 실행 환경을 추가해 HAP-gpt 기기 칩 표시에 사용한다. OAuth 토큰과 pair는 이 응답에 포함하지 않는다.

0.2.8부터 Git 설치판은 저장소 전체 커밋과 함께 `bridge-main` 폴더의 Git tree를 비교한다. 원격에 HAP userscript·문서 등 다른 변경만 있고 브리지 버전과 파일이 같으면 **최신**으로 표시한다. 브리지 폴더가 실제로 달라졌거나 설치본 버전이 뒤처졌을 때만 **업데이트 있음**으로 표시한다.

0.2.7은 최근 작업의 로컬 출처 표시를 추가한다. Git 설치판은 서버 탭의 **Git 업데이트**로 받을 수 있다. ZIP 공개 배포본에는 공개 저장소가 별도로 갱신된 뒤 포함된다.

0.2.6으로 올리는 첫 업데이트는 기존 서버에 ZIP 업데이트와 설치 방식 감지 기능이 없으므로 한 번만 수동으로 실행한다. Git 설치판은 아래 명령을 쓴다.

```bash
cd ~/gpt-codex-work
git pull --ff-only origin wish-core-patch
cd gpt-brige-crack/bridge-main
bash update-termux.sh
bash ~/local-gpt-subscription-bridge/start.sh
```

ZIP 설치판은 공개 배포 폴더에서 최신 ZIP을 다시 받은 뒤 압축 안의 `termux-bridge` 폴더에서 다음을 실행한다.

```bash
bash update-termux.sh
bash ~/local-gpt-subscription-bridge/start.sh
```

0.2.6이 실행된 뒤부터는 서버 탭에서 설치 방식에 맞는 버튼을 사용하면 된다.

0.2.6부터 서버 탭의 **업데이트 확인**이 설치 방식에 맞는 원격 버전만 가져와 현재 실행 버전과 비교한다. 이 단계에서는 프로그램 파일과 작업 자료를 바꾸거나 서버를 재시작하지 않는다.

- Git 설치판은 **Git 업데이트**가 활성화된다. 현재 clone의 원격 브랜치를 fast-forward로 받은 뒤 설치 파일을 갱신한다. 로컬 수정·앞선 커밋·갈라진 기록은 자동 적용하지 않는다.
- ZIP 설치판은 **ZIP 업데이트**가 활성화된다. 공개 RpCleanerEpub의 `version.json`과 단독 브리지 ZIP을 비교하고, 적용 시 Node.js로 ZIP을 내려받는다. `unzip`이 없으면 Termux의 `pkg install -y unzip`으로 자동 설치한다. 공식 저장소 주소·32MiB 크기 제한·압축 내부 경로·필수 파일·브리지 버전을 확인한 뒤 프로그램 파일만 갱신한다.
- 기존 Git 설치판은 한 번 수동 업데이트를 실행하면 설치 원본 경로를 기록한다. 공개 저장소의 기본 clone 위치도 자동으로 찾으며, 특수 경로는 `GPT_BRIDGE_SOURCE=/실제/저장소/.../bridge-main`로 지정할 수 있다.

업데이트 완료 표시가 보이지 않으면 복구 안내를 유지하며, 새 서버에 재연결한 것을 확인한 경우에만 이 안내 기록을 지운다. 계정·pair·작업 기록은 `~/.local-gpt-subscription-bridge`에 그대로 유지한다.

## 상태와 오류

- `LOGIN_REQUIRED`: 관리 화면에서 Continue with ChatGPT 로그인을 완료한다.
- `PLAN_PERMISSION`: 현재 계정·워크스페이스에 `chatgpt.tokens.use.direct` 권한이 발급되지 않았다. 공식 지원 여부와 승인을 확인한다.
- `429`, `subscription_sharing_usage_limit_exceeded`, `subscription_sharing_usage_unavailable`: 구독 또는 서비스 한도다. 브리지가 새 요청을 일시정지하며 API 키로 자동 전환하지 않는다.
- `blocked_budget`: 브리지에 설정한 로컬 호출 횟수 보호에 걸린 상태다. 공식 구독 잔여량과 다르며 관리 화면에서 한도를 검토한 뒤 같은 요청을 재개할 수 있다.
- `INTERRUPTED`: 서버가 종료될 때 queued/running이었던 작업이다. 사용량 소모 여부가 불확실하므로 자동 재전송하지 않는다.
- `MODEL_UNAVAILABLE`: 현재 계정의 `/api/models` 목록에서 다시 선택한다.
- `MODEL_EFFORT`: 선택한 모델이 허용하는 추론 강도로 바꾼다.
- 연결 실패: Termux 실행 여부, `127.0.0.1` 주소, 포트, pair를 확인한다.

오류나 부분 텍스트는 HAP-gpt 자료에 반영되지 않는다. GET 상태 조회는 새 AI 호출을 만들지 않는다.

## 보안과 공식 계약

- OAuth access·refresh·ID token은 `~/.local-gpt-subscription-bridge`에만 저장하고 파일 권한을 `0600`으로 유지한다.
- dynamic client registration, 안정적인 `ext_agent_host_id`, 매 로그인 시 새 state·nonce·PKCE, 정확한 `127.0.0.1` callback을 사용한다.
- 발급된 client ID와 `chatgpt.tokens.use.direct` 권한을 확인한다.
- 로그아웃 시 공식 revocation endpoint로 refresh token 폐기를 시도한다.
- 추론은 공개 `https://api.openai.com/v1/responses`만 사용하며 `store:false`, `stream:true`로 전송하고 `response.completed`만 성공으로 처리한다.
- `max_output_tokens`, `temperature` 등 공식 구독 경로의 미지원 필드를 전송하지 않는다.

참고 구현의 MIT 라이선스는 [LICENSE](LICENSE)에 포함돼 있다.
