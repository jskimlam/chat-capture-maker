# Chat Capture Maker

KakaoTalk, WeChat, WhatsApp, Telegram 스타일의 1:1 대화를 작성하고, 한국어 원문을 영어/일본어/중국어로 자연스럽게 변환한 뒤 PNG 캡처 이미지로 저장하는 GitHub Pages 앱입니다.

> 이 프로젝트는 채팅 UI **mockup/콘텐츠 제작용**입니다. 특정 서비스의 공식 앱이 아니며, 실제 대화 기록을 증명하는 용도로 사용하지 마세요.

## 주요 기능

- 플랫폼 선택: KakaoTalk / WeChat / WhatsApp / Telegram
- 사용자 A/B 이름 및 프로필 이미지 지정
- 대화방 이름, 대화 날짜, 시작 시간 지정
- 날짜는 대화 시작 위치에 1회 표시
- 메시지 시간 자동 생성
- `A:` / `B:` 형식 대화 일괄 입력 및 파싱
- 메시지별 화자 전환 / 텍스트 수정 / 삭제
- 영어 / 일본어 / 중국어 AI 번역
- AI 기반 자연스러운 메신저 문체 보정
- 전문용어 및 업무 상황 힌트
- 플랫폼별 실시간 Preview
- WhatsApp / Telegram 읽음 체크, KakaoTalk 읽지 않음 숫자 표시 옵션
- 현재 화면 PNG / 전체 대화 Long PNG 저장
- LocalStorage 임시 저장 / 불러오기
- Mockup 표시 On/Off
- Apps Script 앱 비밀번호 + 6시간 임시 세션 인증
- AI 요청 세션별 분당 호출 제한

## 파일 구조

```text
/
├─ index.html
├─ styles.css
├─ app.js
└─ gas/
   ├─ Code.gs
   └─ appsscript.json
```

## GitHub Pages

저장소의 **Settings → Pages**에서 배포 소스를 `Deploy from a branch`로 선택하고 `main / (root)`를 지정합니다.

배포 주소:

```text
https://jskimlam.github.io/chat-capture-maker/
```

GitHub Pages 무료 배포를 위해 저장소를 Public으로 운영해도 OpenAI API Key와 앱 비밀번호는 저장소에 넣지 않습니다.

## Google Apps Script + OpenAI 설정

### 1. Apps Script 프로젝트 생성

Google Apps Script 새 프로젝트를 만들고 이 저장소의 `gas/Code.gs` 내용을 Apps Script의 `Code.gs`에 붙여넣습니다.

### 2. Script Properties 설정

Apps Script의 **Project Settings → Script Properties**에 다음 값을 추가합니다.

```text
OPENAI_API_KEY = 본인의 OpenAI API Key
APP_PASSWORD = Chat Capture Maker에서 사용할 별도 비밀번호
OPENAI_MODEL = gpt-5.6-luna   (선택 사항)
```

`OPENAI_MODEL`을 생략하면 `gpt-5.6-luna`를 사용합니다. 번역/문체 보정처럼 반복 호출되는 작업에 비용 효율적인 모델을 기본값으로 사용하도록 구성되어 있습니다.

**중요:** `OPENAI_API_KEY`와 `APP_PASSWORD`를 `index.html`, `app.js`, GitHub Issues, README 등에 적지 마세요.

### 3. Web App 배포

Apps Script에서 **Deploy → New deployment → Web app**으로 배포합니다.

- Execute as: 본인
- 접근 권한: GitHub Pages 브라우저에서 호출할 수 있도록 설정
- 배포 후 생성되는 `/exec` URL 복사

### 4. 앱 연결

Chat Capture Maker에서 **AI 연결 설정**을 열고:

1. Apps Script Web App `/exec` URL 입력
2. `APP_PASSWORD`에 설정한 비밀번호 입력
3. **연결 테스트** 클릭

성공하면 브라우저에는 Web App URL만 장기 저장되고, 비밀번호는 영구 저장되지 않습니다. Apps Script가 6시간짜리 임시 인증 토큰을 발급하며 토큰은 현재 브라우저 탭의 `sessionStorage`에만 저장됩니다.

## 보안 구조

```text
Public GitHub Pages
        ↓
APP_PASSWORD 인증
        ↓
6시간 임시 세션 토큰
        ↓
Google Apps Script
        ↓
OPENAI_API_KEY (Script Properties에만 존재)
        ↓
OpenAI Responses API
```

Apps Script는 AI 요청에 대해 메시지 수/길이 제한 및 세션당 분당 호출 제한을 적용합니다. Public Repository에는 API Key나 앱 비밀번호가 포함되지 않습니다.

## 입력 예시

```text
A: 오늘 SM 시장 어때?
B: 중국 내수에서 prompt short covering이 계속 나오고 있어.
A: LG도 이제 들어오나 보네. 금호는 구매 끝난 줄 알았는데.
B: 한국과 일본 쪽 물량이 거의 말라서 필요하면 중국밖에 없을 듯.
```

`A`는 나, `B`는 상대방으로 렌더링됩니다.

## 현재 AI 동작

- **EN 영어**: 원문 → 자연스러운 영어 채팅
- **日本語**: 원문 → 자연스러운 일본어 채팅
- **中文**: 원문 → 자연스러운 중국어 채팅
- **한국어 원문**: 최초 입력 내용으로 복원
- **자연스럽게**: 현재 표시 언어를 유지하면서 실제 메신저 대화처럼 표현을 다듬음

숫자, 회사명, 제품명, 가격, CFR/FOB, SM/BD/ACN 등 상업·석유화학 용어를 임의로 추가하거나 변경하지 않도록 프롬프트를 구성했습니다.

## 다음 확장 후보

- 그룹채팅
- Reply / Forward 메시지
- 사진/파일/링크 카드
- 메시지 단위 시간 수동 보정
- Google Drive PNG 저장
- 프로젝트 DB 저장 및 다시 불러오기
- LINE / iMessage 스타일 추가
