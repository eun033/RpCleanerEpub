# GPT 브리지 0.2.8

상위 설치 안내: [Wish RP Core HAP-gpt](https://github.com/eun033/RpCleanerEpub/tree/main/main/wish-core-hap-gpt)

같은 Android 기기의 `127.0.0.1`에서만 실행되는 Node.js 표준 라이브러리 기반 브리지다. 공식 Sign in with ChatGPT 인증과 `/v1/responses` 스트림 처리를 맡는다. HAP-gpt userscript에는 OAuth 토큰을 전달하지 않는다.

## 처음 설치

Termux에서 다음을 실행한다.

```bash
pkg update
pkg install git nodejs-lts
git clone https://github.com/eun033/RpCleanerEpub.git
cd RpCleanerEpub/main/wish-core-hap-gpt/termux-bridge
bash install-termux.sh
```

Node.js 22 이상이 필요하고 별도 npm 패키지는 설치하지 않는다. 설치본은 `~/local-gpt-subscription-bridge`, OAuth 인증과 작업 기록은 권한이 제한된 `~/.local-gpt-subscription-bridge`에 저장된다.

## 최초 로그인과 pair 연결

1. 실행 시 표시되는 `http://127.0.0.1:17446/#pair=…` 주소 전체를 같은 폰의 브라우저에서 연다.
2. **Continue with ChatGPT**를 눌러 본인 계정과 워크스페이스로 승인한다.
3. **사용 가능한 모델 확인**을 눌러 계정별 목록을 확인한다.
4. **확장 프로그램용 연결 주소 복사**를 눌러 HAP-gpt 설정에 붙여 넣는다.

관리 화면은 각진 카드와 버튼을 사용하며 기기의 다크·라이트 모드를 따른다. 활성 항목에 점과 아래선을 표시하는 `서버`·`최근 작업`·`설정` 탭으로 나뉜다. 연결 코드가 없거나 연결 확인에 실패하면 설정 탭을 열고, 정상 연결되면 서버 탭을 연다. 서버 탭에는 서버 관리와 호출량, 설정 탭에는 로컬 연결·ChatGPT 구독·호출량 설정이 있다. 상단의 옅게 번지는 녹색 신호는 로컬 서버가 정상 응답 중이라는 뜻이다. 서버 관리 제목 오른쪽 **↻ 서버**는 파일을 받지 않고 서버만 재시작한다. 최근 작업 탭의 큰 ↻ 버튼은 상태만 다시 읽으며 AI 요청을 만들지 않는다.

0.2.7부터 최근 작업의 접힌 항목을 54px 한 줄 목록으로 표시해 한 화면에서 더 많은 작업을 확인할 수 있다. 요청한 확프가 선택적으로 보낸 로컬 표시용 `client` 정보가 있으면 `방 이름 · 작업명`과 확프 이름을 표시한다. HAP-gpt 0.1.4가 이 정보를 보낸다. 구버전과 다른 확프처럼 정보가 없는 요청은 종전처럼 모델명만 표시한다. 표시 정보는 작업 JSON에만 저장하고 OpenAI Responses 요청 본문에는 전달하지 않는다.

ChatGPT 연결이 확인되면 계정 버튼은 **재연결**로 바뀐다. 최초 연결 직후 모델 목록을 자동으로 가져오며, **모델 확인**을 누르면 최신 목록으로 갱신한다. 성공한 모델 목록과 마지막 확인 시각은 관리 화면을 연 브라우저의 `localStorage`에 저장한다. OAuth 토큰은 브라우저에 저장하지 않는다.

연결 코드는 기본적으로 현재 브라우저 탭 세션에만 남는다. **이 브라우저에 연결 코드 저장**을 선택하면 같은 `127.0.0.1:포트` 주소의 브라우저 저장소에 보관되어 브라우저를 다시 열어도 사용할 수 있다. 공용 기기에서는 선택하지 않는다. 포트가 바뀌면 브라우저 출처도 달라지므로 새 주소에서 다시 연결한다.

공식 계정 모델 목록은 표시용 `slug`와 `display_name`만 보장한다. 추론 강도 정보가 없으면 다음 공식 모델 문서 범위를 적용한다.

- GPT-6.1 Sol·GPT-6 Astra: `낮음`부터 `최대`
- GPT-6.1 Terra·GPT-6 Sol·GPT-6 Luna·GPT-5.6 Sol·GPT-5.6 Terra·GPT-5.6 Luna: `끄기`부터 `최대`

계정 목록이 추론 강도를 직접 제공하면 그 값을 우선한다. GPT-5.6 Sol의 공식 `gpt-5.6` 별칭도 같은 범위로 처리한다.

`pair`는 OpenAI 토큰은 아니지만 이 로컬 서버를 제어하는 비밀값이다. 토큰 파일, `pair`, 연결 주소를 다른 사람·GitHub·로그·지원 문의에 공개하지 않는다.

## 호출량 표시

- 최근 5시간·7일 수치는 이 브리지의 저장된 작업 중 실제 AI 호출을 시작한 횟수다.
- 진행 막대의 최대치는 관리 화면에서 정한 로컬 보호 한도이며 ChatGPT 공식 잔여량이나 크레딧이 아니다.
- 화면 수치는 브리지의 로컬 호출량이므로 남은 공식 한도는 반드시 **공식 한도 확인**에서 확인한다. 공식 문서에는 잔여량을 브리지로 가져오는 공개 API가 없다.
- 새로고침에 성공하면 화면 수치와 마지막 갱신 시각을 브라우저에 저장한다. 작업 기록과 실제 집계 원본은 브리지의 로컬 작업 파일에 남는다.
- 0.1.x의 24시간 한도는 0.2.0에서 7일 한도로 바뀐다. 기존 최대 글자 수와 5시간 한도는 유지하고, 7일 한도는 안전한 기본값 200회로 시작한다.

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

0.2.8부터 Git 설치판은 저장소 전체 커밋과 함께 `termux-bridge` 폴더의 Git tree를 비교한다. 원격에 HAP userscript·문서 등 다른 변경만 있고 브리지 버전과 파일이 같으면 **최신**으로 표시한다. 브리지 폴더가 실제로 달라졌거나 설치본 버전이 뒤처졌을 때만 **업데이트 있음**으로 표시한다.

0.2.7은 최근 작업의 로컬 출처 표시를 추가했다. Git·ZIP 설치판 모두 서버 탭에서 현재 공개 배포본으로 갱신할 수 있다.

0.2.6으로 올리는 첫 업데이트는 기존 서버에 ZIP 업데이트와 설치 방식 감지 기능이 없으므로 한 번만 수동으로 실행한다. Git 설치판은 아래 명령을 쓴다.

```bash
cd ~/RpCleanerEpub
git pull --ff-only origin main
cd main/wish-core-hap-gpt/termux-bridge
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
- ZIP 설치판은 **ZIP 업데이트**가 활성화된다. 공개 RpCleanerEpub 배포 ZIP과 브리지 버전을 비교하고, 적용 시 Node.js로 ZIP을 내려받는다. `unzip`이 없으면 Termux의 `pkg install -y unzip`으로 자동 설치한다. 공식 저장소 주소·32MiB 크기 제한·압축 내부 경로·필수 파일·브리지 버전을 확인한 뒤 프로그램 파일만 갱신한다.
- 기존 Git 설치판은 한 번 수동 업데이트를 실행하면 설치 원본 경로를 기록한다. 공개 저장소의 기본 clone 위치도 자동으로 찾으며, 특수 경로는 `GPT_BRIDGE_SOURCE=/실제/저장소/.../termux-bridge`로 지정할 수 있다.

업데이트 완료 표시가 보이지 않으면 **5분 뒤 페이지를 다시 열고 서버 관리의 ↻ 서버를 누르라**는 안내를 유지하며, 정상 완료 응답을 받은 경우에만 이 안내 기록을 지운다. 계정·pair·작업 기록은 `~/.local-gpt-subscription-bridge`에 그대로 유지한다.

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
