# 🪽🐡🪨 Wish RP Core HAP-gpt 0.1.9

Wish Core 2.0.5와 HAP 기능에 `ChatGPT 구독` 공급자를 추가한 단일 userscript다. ChatGPT 구독 호출은 같은 기기에서 실행하는 GPT 브리지가 담당한다. Android Termux를 기본 설치 경로로 사용하며 Windows Git 실행도 지원한다.

현재 배포 버전은 HAP-gpt 0.1.9, GPT 브리지 0.2.11이다.

기존 Core·Cloud Patch·HAP은 끄고 HAP-gpt 하나만 사용한다. 기존 AI Studio·Firebase·Vertex·DeepSeek·Claude·OpenAI API·외부 AI 설정은 보존되며, ChatGPT 구독 실패 시 다른 유료 API로 자동 전환하지 않는다.

## 1. HAP-gpt 설치

[HAP-gpt 0.1.9 설치 파일](https://raw.githubusercontent.com/eun033/RpCleanerEpub/refs/heads/main/main/wish-core-hap-gpt/Wish_RP_Core_HAP_GPT.user.js)을 Tampermonkey로 연다.

설치 파일의 `@updateURL`과 `@downloadURL`도 위 공개 주소를 사용한다.

## 2. GPT 브리지 설치 방식

자기 기기에 맞는 방식 하나를 선택한다. 공개 저장소를 받는 데 GitHub 계정은 필요하지 않다. Node.js 22 이상이 필요하다.

### A. Android ZIP 설치

Git을 쓰지 않는 사용자를 위한 방식이다. Termux에서 다음을 실행한다.

```bash
pkg update
pkg install nodejs-lts unzip curl
cd ~
curl -L -o hap-gpt.zip https://raw.githubusercontent.com/eun033/RpCleanerEpub/refs/heads/main/main/wish-core-hap-gpt/Wish_RP_Core_HAP_GPT_0.1.9.zip
unzip -o hap-gpt.zip
cd wish-core-hap-gpt/termux-bridge
bash install-termux.sh
```

브리지 0.2.6 이상이 실행된 뒤부터는 관리 화면의 서버 탭에서 **ZIP 업데이트**를 사용할 수 있다. 압축 해제 도구가 없으면 Termux가 자동으로 설치하며 계정·pair·작업 기록은 유지한다.

### B. Android Git clone·pull 설치

```bash
pkg update
pkg install git nodejs-lts
cd ~
git clone https://github.com/eun033/RpCleanerEpub.git
cd RpCleanerEpub/main/wish-core-hap-gpt/termux-bridge
bash install-termux.sh
```

이미 저장소를 받은 경우 다음처럼 수동 갱신할 수 있다.

```bash
cd ~/RpCleanerEpub
git pull --ff-only origin main
cd main/wish-core-hap-gpt/termux-bridge
bash update-termux.sh
bash ~/local-gpt-subscription-bridge/start.sh
```

### C. Windows Git 설치

Git과 Node.js 22 이상을 설치하고 PowerShell에서 실행한다.

```powershell
cd $HOME
git clone https://github.com/eun033/RpCleanerEpub.git
cd "$HOME\RpCleanerEpub\main\wish-core-hap-gpt\termux-bridge"
powershell -ExecutionPolicy Bypass -File .\start-windows.ps1
```

`start-windows.ps1`로 실행해야 관리 화면의 **↻ 서버**와 Git 업데이트 후 자동 재시작이 동작한다. `node src/server.mjs`로 직접 실행하면 AI 요청은 가능하지만 관리 화면에 **재시작 지원 실행 필요**가 표시된다. WSL은 기기 칩에서 Windows로 인식한다.

### D. Windows ZIP 설치

Git을 설치하지 않을 경우 [HAP-gpt 0.1.9 ZIP](https://raw.githubusercontent.com/eun033/RpCleanerEpub/refs/heads/main/main/wish-core-hap-gpt/Wish_RP_Core_HAP_GPT_0.1.9.zip)을 내려받아 압축을 푼다. PowerShell에서 압축을 푼 브리지 폴더로 이동해 실행한다.

```powershell
cd "$HOME\Downloads\wish-core-hap-gpt\termux-bridge"
powershell -ExecutionPolicy Bypass -File .\start-windows.ps1
```

이 방식은 서버 탭에서 **ZIP 업데이트**를 사용한다. Windows 기본 PowerShell의 ZIP 기능으로 새 파일을 확인·적용한 뒤 같은 브리지를 다시 시작하며 계정·pair·작업 기록은 유지한다.

## 3. 연결

관리 화면은 `서버`·`최근 작업`·`설정` 3탭이다. 로컬 연결 전에는 설정 탭, 정상 연결되면 서버 탭이 열린다. 상단이 `서버 정상 · 요청 일시정지`라면 서버는 실행 중이며 새 요청만 멈춘 상태이므로 **요청 재개**를 누른다.

브리지 호출량은 로컬 기록과 보호 한도다. ChatGPT 구독의 남은 공식 한도는 반드시 서버 탭의 **공식 한도 확인**에서 확인한다.

1. 브리지가 표시한 `http://127.0.0.1:17446/#pair=…` 주소 전체를 같은 기기의 브라우저에서 연다.
2. **Continue with ChatGPT**로 본인 ChatGPT 계정에 로그인한다.
3. **사용 가능한 모델 확인**을 누른다.
4. **확장 프로그램용 연결 주소 복사**를 누른다.
5. HAP-gpt의 `설정 → 보조 AI 연결`에서 `ChatGPT 구독`을 선택한다.
6. `+`로 기기 이름을 만들고 연결 주소를 붙여 넣은 뒤 모델과 추론 강도를 저장한다.

최대 5개 기기 주소를 칩으로 보관할 수 있다. 칩을 짧게 누르면 연결을 바꾸고, 약 0.55초 길게 누르면 이름을 변경한다. 칩이 한 줄을 넘으면 손가락이나 마우스로 잡아 좌우로 끈다. Android·macOS·Windows 아이콘은 모델 확인 때 브리지가 알려 준 환경으로 자동 저장한다.

상세한 시작·업데이트·오류 안내는 [GPT 브리지 안내](https://github.com/eun033/RpCleanerEpub/blob/main/main/wish-core-hap-gpt/termux-bridge/README.md)를 참고한다.

## 4. 240초가 지난 작업 이어받기

브리지의 **최근 작업**에서 해당 요청이 `완료`로 바뀐 뒤 오류가 난 원래 방의 **다시 시도**를 누른다. HAP-gpt는 새 AI 요청을 보내지 않고 보존된 요청 번호의 결과를 다시 조회한다.

절약 모드 검사 뒤의 전체 상태 재요청과 형식 보정 재요청도 원래 단계로 돌아간다. 결과는 기존 JSON 검사와 방·대화·모델·설정 재검증을 모두 통과해야 저장된다.

ChatGPT 구독 요청에만 `Wish HAP-gpt`·방 이름·작업명을 로컬 표시용 정보로 붙여 브리지 최근 작업에서 확인할 수 있다. 이 정보는 OpenAI 요청 본문이나 다른 AI 공급자 호출에 넣지 않는다.

## 5. 업데이트

- Git 설치판은 서버 탭에서 원격 브리지 파일을 비교한 뒤 **Git 업데이트**를 사용할 수 있다.
- ZIP 설치판은 가장 높은 공개 배포 ZIP 버전을 비교한 뒤 **ZIP 업데이트**를 사용할 수 있다.
- 공개 저장소의 다른 파일만 바뀌고 브리지 폴더와 버전이 같으면 다시 업데이트가 있다고 표시하지 않는다.
- 대기·진행 중인 작업이 있으면 데이터 보호를 위해 업데이트와 재시작을 막는다.

## 보안

- OAuth access·refresh·ID token은 `~/.local-gpt-subscription-bridge`에만 저장한다.
- userscript에는 `127.0.0.1` 연결 주소와 pair만 저장한다.
- pair와 연결 주소도 로컬 브리지를 제어하는 비밀값이므로 GitHub·로그·지원 글에 공개하지 않는다.
- 브리지는 `store:false`, `stream:true`로 요청하고 `response.completed` 결과만 HAP-gpt에 전달한다.

## 배포 파일

- `Wish_RP_Core_HAP_GPT.user.js`: Tampermonkey 설치·자동 업데이트 파일
- `Wish_RP_Core_HAP_GPT_0.1.9.zip`: Git 없이 Android·Windows에 설치하는 묶음
- `termux-bridge/`: Git clone·pull 설치와 Windows 실행에 사용하는 파일
- `SHA256SUMS`: userscript와 ZIP 무결성 값

빌더, 테스트, 개발 로그, 과거 버전 보관본은 공개 배포 폴더에 포함하지 않는다.
