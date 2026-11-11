# 🪽🐡🪨 Wish RP Core HAP-gpt 0.2.5

Wish Core 2.0.5와 HAP 기능에 `ChatGPT 구독` 공급자를 추가한 단일 userscript다. ChatGPT 구독 호출은 같은 기기에서 실행하는 GPT 브리지가 담당한다. Android Termux를 기본 설치 경로로 사용하며 Windows Git 실행도 지원한다.

현재 userscript 배포 버전은 HAP-gpt 0.2.5다. GPT 브리지는 별도 `main/gpt-bridge` 배포를 사용한다.

중요 내용은 남기고 오래되어 해결된 반복 과정부터 줄이는 보강 지침은 실행판과 분리해 [복사용 Markdown](API_MEMORY_GUIDE_IMPORTANCE_COMPRESSION.md)에 보관한다. 파일 본문 전체를 그대로 복사해 사용할 수 있다.

기존 Core·Cloud Patch·HAP은 끄고 HAP-gpt 하나만 사용한다. 기존 AI Studio·Firebase·Vertex·DeepSeek·Claude·OpenAI API·외부 AI 설정은 보존되며, ChatGPT 구독 실패 시 다른 유료 API로 자동 전환하지 않는다.

0.2.5는 2026-11-11 공식 출시된 `gemini-4-carbon`을 AI Studio·Firebase·Vertex 모델 선택에 추가했다. Firebase·Vertex에서는 지원 위치인 `global`로 호출하며, 공식 종료일은 아직 발표되지 않았다.

0.2.0부터 다른 방 자료 복사에서 연표 카드를 선택해 새 방의 수동 보호 사본으로 가져올 수 있다. 같은 내용의 기존 카드는 중복 복사하지 않는다. ChatGPT 구독 통합 정리는 240초 뒤에도 같은 요청 번호를 30초 간격으로 두 번 더 확인해 약 5분까지 기다리며, 확인 중에는 새 요청을 보내지 않는다.

0.2.1은 자료 관리의 기존 2차 재구축 바로 아래에 **2차 재구축 (40% 이상 축소 목표)**를 추가한다. 목표 축소율은 40%와 50% 중 하나를 고른다. TXT를 외부 AI에 전달하고 결과 JSON을 가져오면 원문과 압축 결과를 비교해 선택 적용할 수 있다. 연표는 유지하며, 교체 직전 원본은 최근 5회 자동 보관한다.

0.2.4는 통합 정리의 마지막 AI 응답 원문을 로컬에 하나 보관한다. JSON 파싱 오류가 나면 **다시 적용**으로 AI를 다시 호출하지 않고 저장된 응답만 다시 해석·검증할 수 있다. 같은 방·대화·설정에서 만든 응답일 때만 적용하며, 옆의 복사 아이콘으로 원문 전체를 복사할 수 있다. 정상 적용 후에는 보관 응답을 지운다.

Firebase와 Google Drive 백업 복원 창 하단에 중복으로 붙던 기존 자료 삭제 영역을 제거했다. 로컬 자료 정리는 `자료 관리 → 백업 · 복원 → 로컬 데이터 정리`에서 계속 사용할 수 있다.

## 1. HAP-gpt 설치

[HAP-gpt 0.2.5 설치 파일](https://raw.githubusercontent.com/eun033/RpCleanerEpub/refs/heads/main/main/wish-core-hap-gpt/Wish_RP_Core_HAP_GPT.user.js)을 Tampermonkey로 연다.

설치 파일의 `@updateURL`과 `@downloadURL`도 위 공개 주소를 사용한다.

## 2. GPT 브리지 설치

GPT 브리지는 HAP-gpt userscript와 분리해 [GPT 브리지 배포 폴더](https://github.com/eun033/RpCleanerEpub/tree/main/main/gpt-bridge)에서 관리한다. Android ZIP·Git 설치와 Windows 실행 방법은 [GPT 브리지 안내](https://github.com/eun033/RpCleanerEpub/blob/main/main/gpt-bridge/README.md)를 따른다.

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

상세한 시작·업데이트·오류 안내는 [GPT 브리지 안내](https://github.com/eun033/RpCleanerEpub/blob/main/main/gpt-bridge/README.md)를 참고한다.

## 4. 240초가 지난 작업 이어받기

브리지의 **최근 작업**에서 해당 요청이 `완료`로 바뀐 뒤 오류가 난 원래 방의 **다시 시도**를 누른다. HAP-gpt는 새 AI 요청을 보내지 않고 보존된 요청 번호의 결과를 다시 조회한다.

절약 모드 검사 뒤의 전체 상태 재요청과 형식 보정 재요청도 원래 단계로 돌아간다. 결과는 기존 JSON 검사와 방·대화·모델·설정 재검증을 모두 통과해야 저장된다.

ChatGPT 구독 요청에만 `Wish HAP-gpt`·방 이름·작업명을 로컬 표시용 정보로 붙여 브리지 최근 작업에서 확인할 수 있다. 이 정보는 OpenAI 요청 본문이나 다른 AI 공급자 호출에 넣지 않는다.

## 5. 2차 재구축 40% 이상 축소

`자료 관리 → 2차 재구축 (40% 이상 축소 목표)`에서 **① 지침 + TXT 받기**를 누른다. 목표 축소율은 40% 또는 50%를 선택한다. 받은 TXT를 새 AI 대화에 첨부하거나 HAP-gpt의 GPT 전송 버튼으로 보낸 뒤, 결과 JSON을 **② 결과 JSON 가져오기**로 연다.

적용 화면에서 원문과 결과를 비교하고 실제로 바꿀 항목만 선택한다. 이 작업은 저장 원문을 교체하므로 적용 직전 원본을 자동 보관한다. **교체 전 원본 보관함**에서 최근 5회 원본을 내려받거나 복원할 수 있다. 연표는 AI가 참고만 하며 수정하지 않는다. 기타/OOC는 내보내기 창에서 포함 여부를 선택한다.

## 6. 업데이트

- HAP-gpt는 Tampermonkey가 공개 `Wish_RP_Core_HAP_GPT.user.js`의 버전을 확인해 갱신한다.
- GPT 브리지의 Git·ZIP 업데이트와 서버 재시작은 [별도 브리지 안내](https://github.com/eun033/RpCleanerEpub/blob/main/main/gpt-bridge/README.md)를 따른다.

## 보안

- OAuth access·refresh·ID token은 `~/.local-gpt-subscription-bridge`에만 저장한다.
- userscript에는 `127.0.0.1` 연결 주소와 pair만 저장한다.
- pair와 연결 주소도 로컬 브리지를 제어하는 비밀값이므로 GitHub·로그·지원 글에 공개하지 않는다.
- 브리지는 `store:false`, `stream:true`로 요청하고 `response.completed` 결과만 HAP-gpt에 전달한다.

## 배포 파일

- `Wish_RP_Core_HAP_GPT.user.js`: Tampermonkey 설치·자동 업데이트 파일
- `README.md`: HAP-gpt 설치·사용 안내
- `API_MEMORY_GUIDE_IMPORTANCE_COMPRESSION.md`: 별도 복사용 기억 정리 지침
- `SHA256SUMS`: 공개 파일 무결성 값

GPT 브리지 파일과 ZIP은 `main/gpt-bridge`에서 별도로 배포한다. 빌더, 테스트, 개발 로그, 과거 버전 보관본은 공개 배포 폴더에 포함하지 않는다.
