# 🪽🐡🪨 Wish RP Core HAP-gpt 0.1.4

Wish Core 2.0.5와 HAP 기능에 `ChatGPT 구독` 공급자를 추가한 단일 userscript다. ChatGPT 구독 호출은 같은 Android 기기에서 실행하는 GPT 브리지가 담당한다.

기존 Core·Cloud Patch·HAP은 끄고 HAP-gpt 하나만 사용한다. 기존 AI Studio·Firebase·Vertex·DeepSeek·Claude·OpenAI API·외부 AI 설정은 보존되며, ChatGPT 구독 실패 시 다른 유료 API로 자동 전환하지 않는다.

## 1. HAP-gpt 설치

[HAP-gpt 0.1.4 설치 파일](https://raw.githubusercontent.com/eun033/RpCleanerEpub/refs/heads/main/main/wish-core-hap-gpt/Wish_RP_Core_HAP_GPT.user.js)을 Tampermonkey로 연다.

설치 파일의 `@updateURL`과 `@downloadURL`도 위 공개 주소를 사용한다.

## 2. GPT 브리지 설치 방식

두 방식 중 하나만 선택한다. GitHub 계정은 어느 방식에도 필요하지 않다.

### A. ZIP 설치

Git을 쓰지 않는 사용자를 위한 방식이다. Termux에서 다음을 실행한다.

```bash
pkg update
pkg install nodejs-lts unzip curl
cd ~
curl -L -o hap-gpt.zip https://raw.githubusercontent.com/eun033/RpCleanerEpub/refs/heads/main/main/wish-core-hap-gpt/Wish_RP_Core_HAP_GPT_0.1.4.zip
unzip -o hap-gpt.zip
cd wish-core-hap-gpt/termux-bridge
bash install-termux.sh
```

브리지 0.2.6 미만에서 처음 올릴 때만 새 ZIP을 다시 받아 `update-termux.sh`를 실행한다. 이후에는 관리 화면의 서버 탭에서 **ZIP 업데이트**를 누르면 공개 ZIP을 내려받아 갱신한다. `unzip`이 없으면 Termux가 자동으로 설치하고, 계정·pair·작업 기록은 유지한다.

### B. Git clone·pull 설치

관리 화면의 서버 탭에서 새 버전을 비교하고 **Git 업데이트**로 `git pull --ff-only` 갱신할 수 있는 방식이다.

```bash
pkg update
pkg install git nodejs-lts
cd ~
git clone https://github.com/eun033/RpCleanerEpub.git
cd RpCleanerEpub/main/wish-core-hap-gpt/termux-bridge
bash install-termux.sh
```

이미 저장소를 받은 경우 다음처럼 수동 갱신할 수도 있다.

```bash
cd ~/RpCleanerEpub
git pull --ff-only origin main
cd main/wish-core-hap-gpt/termux-bridge
bash update-termux.sh
bash ~/local-gpt-subscription-bridge/start.sh
```

## 3. 연결

관리 화면은 `서버`·`최근 작업`·`설정` 3탭이다. 로컬 연결 전이나 연결 확인 실패 시 설정 탭이 먼저 열리고, 정상 연결되면 서버 탭이 열린다. 서버 탭에는 서버 관리와 브리지 호출량, 설정 탭에는 로컬 연결·ChatGPT 구독·호출량 설정이 있다. **↻ 서버**는 파일을 받지 않고 서버만 재시작한다.

브리지 호출량은 로컬 기록과 보호 한도다. ChatGPT 구독의 남은 공식 한도는 반드시 서버 탭의 **공식 한도 확인**에서 확인한다.

1. Termux에 표시되는 `http://127.0.0.1:17446/#pair=…` 주소 전체를 같은 휴대폰 브라우저에서 연다.
2. **Continue with ChatGPT**로 본인 ChatGPT 계정에 로그인한다.
3. **사용 가능한 모델 확인**을 누른다.
4. **확장 프로그램용 연결 주소 복사**를 누른다.
5. HAP-gpt의 `설정 → 보조 AI 연결`에서 `ChatGPT 구독`을 선택해 주소를 붙여 넣고 저장한다.

상세한 시작·업데이트·오류 안내는 [GPT 브리지 안내](https://github.com/eun033/RpCleanerEpub/blob/main/main/wish-core-hap-gpt/termux-bridge/README.md)를 참고한다.

## 4. 240초가 지나 실패한 작업 이어받기

브리지의 **최근 작업**에서 해당 요청이 `완료`로 바뀐 뒤, 오류가 난 원래 방의 **다시 시도**를 누른다. HAP-gpt는 새 AI 요청을 보내지 않고 보존된 요청 번호의 결과를 다시 조회한다.

절약 모드 검사 뒤의 전체 상태 재요청과 형식 보정 재요청도 해당 단계로 돌아간다. 결과는 기존 JSON 검사와 방·대화·모델·설정 재검증을 모두 통과해야 저장되며, 기준이 달라졌으면 적용하지 않는다.

기존 결과를 조회할 때 `이전 완료 결과 다시 확인 중` 또는 `이전 전체 상태 결과 다시 확인 중`으로 표시한다. 회수한 절약 모드 답이 안전검사를 통과하지 못하면 그 결과를 강제로 적용하지 않고, 이유를 표시한 뒤에만 실제 전체 상태 신규 요청을 보낸다.

0.1.4부터 ChatGPT 구독 요청에만 `Wish HAP-gpt`·방 이름·작업명을 로컬 표시용 정보로 붙여 브리지 최근 작업에서 확인할 수 있다. 이 정보는 OpenAI 요청 본문이나 다른 AI 공급자 호출에 넣지 않는다.

## 보안

- OAuth access·refresh·ID token은 Termux의 `~/.local-gpt-subscription-bridge`에만 저장한다.
- userscript에는 `127.0.0.1` 연결 주소와 pair만 저장한다.
- pair와 연결 주소도 로컬 브리지를 제어하는 비밀값이므로 GitHub·로그·지원 글에 공개하지 않는다.
- 브리지는 `store:false`, `stream:true`로 요청하고 `response.completed` 결과만 HAP-gpt에 전달한다.

## 배포 파일

- `Wish_RP_Core_HAP_GPT.user.js`: Tampermonkey 설치·자동 업데이트 파일
- `Wish_RP_Core_HAP_GPT_0.1.4.zip`: Git 없이 설치하는 묶음
- `termux-bridge/`: Git clone·pull 설치에 사용하는 실행 파일
- `SHA256SUMS`: userscript와 ZIP 무결성 값

빌더, 테스트, 개발 로그, 과거 버전 보관본은 공개 배포 폴더에 포함하지 않는다.
