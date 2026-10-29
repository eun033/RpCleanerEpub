# GPT 브리지 0.2.5

같은 Android 기기의 `127.0.0.1`에서만 실행되는 Node.js 표준 라이브러리 기반 브리지다. 공식 Sign in with ChatGPT 인증과 `/v1/responses` 스트림 처리를 맡으며 OAuth 토큰을 HAP-gpt userscript에 전달하지 않는다.

상위 설치 안내: [Wish RP Core HAP-gpt](https://github.com/eun033/RpCleanerEpub/tree/main/main/wish-core-hap-gpt)

## 실행

설치 후에는 다음 명령으로 실행한다.

```bash
bash ~/local-gpt-subscription-bridge/start.sh
```

- 중지: 실행 중인 Termux에서 `Ctrl+C`
- 재실행: 위 명령을 다시 실행
- 포트 변경: `GPT_BRIDGE_PORT=18446 bash ~/local-gpt-subscription-bridge/start.sh`
- `EADDRINUSE`: 기존 서버를 중지하거나 다른 포트를 사용하고 HAP-gpt에도 새 연결 주소를 저장한다.

Node.js 22 이상이 필요하며 외부 npm 패키지는 사용하지 않는다. 설치본은 `~/local-gpt-subscription-bridge`, 계정·pair·설정·작업 기록은 권한이 제한된 `~/.local-gpt-subscription-bridge`에 저장된다.

## 로그인과 HAP-gpt 연결

1. 실행 시 표시되는 `http://127.0.0.1:17446/#pair=…` 주소 전체를 같은 기기의 브라우저에서 연다.
2. **Continue with ChatGPT**로 본인 계정과 워크스페이스를 승인한다.
3. **사용 가능한 모델 확인**을 누른다.
4. **확장 프로그램용 연결 주소 복사**를 눌러 HAP-gpt 설정에 저장한다.

ChatGPT 연결이 확인되면 계정 버튼이 **재연결**로 바뀐다. 모델 목록과 마지막 확인 시각은 관리 화면을 연 브라우저의 `localStorage`에 저장하지만 OAuth 토큰은 브라우저에 저장하지 않는다.

`pair`는 OpenAI 토큰은 아니지만 로컬 서버를 제어하는 비밀값이다. 토큰 파일, pair, 연결 주소를 다른 사람·GitHub·로그에 공개하지 않는다.

## 업데이트

### Git 설치

기본 경로 `~/RpCleanerEpub/main/wish-core-hap-gpt/termux-bridge`에서 설치하면 관리 화면의 **업데이트 확인**과 **업데이트 적용**을 사용할 수 있다. 공개 저장소 `main` 브랜치와 현재 버전을 비교하며, 적용 시 `git pull --ff-only origin main` 후 프로그램 파일만 갱신한다.

로컬 수정, 원격보다 앞선 커밋, 갈라진 기록이 있으면 자동 업데이트하지 않는다. 계정·pair·작업 기록은 갱신하지 않는다.

### ZIP 설치

ZIP에는 `.git`이 없으므로 관리 화면의 Git 업데이트 기능은 비활성화된다. 새 ZIP을 받은 뒤 압축을 풀고 다음을 실행한다.

```bash
cd ~/wish-core-hap-gpt/termux-bridge
bash update-termux.sh
bash ~/local-gpt-subscription-bridge/start.sh
```

업데이트 완료 표시가 끊기면 5분 뒤 관리 화면을 다시 열고 **서버 관리 ↻**로 재시작한다. 진행·대기 중 요청이 있으면 데이터 안전을 위해 업데이트와 재시작이 차단된다.

## 사용량 표시

- 5시간·7일 수치는 이 브리지에서 실제 AI 호출을 시작한 횟수다.
- 진행 막대의 최대치는 로컬 보호 한도이며 ChatGPT 공식 잔여량이 아니다.
- 공식 잔여량을 가져오는 공개 API가 없어 **공식 사용량 열기**는 ChatGPT 사용량 화면을 연다.
- 구독 사용량을 OpenAI API 달러 비용으로 환산하지 않는다.

## 재부팅 후 시작

휴대폰 재부팅 후 Termux를 열어 `start.sh`를 실행한다. 자동 시작이 필요하면 Termux:Boot에서 다음 스크립트를 사용한다.

```bash
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
bash ~/local-gpt-subscription-bridge/start.sh >/dev/null 2>&1 &
```

Android 배터리 최적화에서 Termux의 백그라운드 실행을 허용해야 장시간 작업이 중단되지 않는다.

## 상태와 오류

- `LOGIN_REQUIRED`: 관리 화면에서 ChatGPT 로그인을 완료한다.
- `PLAN_PERMISSION`: 현재 계정·워크스페이스에 `chatgpt.tokens.use.direct` 권한이 발급되지 않았다.
- `429`, `subscription_sharing_usage_limit_exceeded`: 구독 또는 서비스 한도다. API 키 공급자로 자동 전환하지 않는다.
- `blocked_budget`: 로컬 호출 횟수 보호에 걸렸다. 한도를 검토한 뒤 같은 요청을 재개할 수 있다.
- `INTERRUPTED`: 서버 종료 당시 진행 중이던 작업이다. 사용량 소모 여부가 불확실하므로 자동 재전송하지 않는다.
- `MODEL_UNAVAILABLE`: 현재 계정의 모델 목록에서 다시 선택한다.
- `MODEL_EFFORT`: 선택한 모델에서 허용되는 추론 강도로 바꾼다.
- 연결 실패: Termux 실행 여부, `127.0.0.1` 주소, 포트와 pair를 확인한다.

오류·거절·미완료·부분 텍스트는 HAP-gpt 자료에 반영하지 않는다. GET 상태 조회는 새 AI 요청을 만들지 않는다.

## 공식 계약

- [Token sharing for open-source apps](https://developers.openai.com/siwc/token-sharing-open-source)
- [Sign in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)

브리지 부분은 [MIT License](https://github.com/eun033/RpCleanerEpub/blob/main/main/wish-core-hap-gpt/termux-bridge/LICENSE)로 배포한다.
