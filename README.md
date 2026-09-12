# Chat Capture Maker

KakaoTalk, WeChat, WhatsApp, Telegram 스타일의 1:1 대화를 작성하고, 한국어 원문을 영어/일본어로 자연스럽게 변환한 뒤 PNG 캡처 이미지로 저장하는 GitHub Pages 앱입니다.

> 이 프로젝트는 채팅 UI **mockup/콘텐츠 제작용**입니다. 특정 서비스의 공식 앱이 아니며, 실제 대화 기록을 증명하는 용도로 사용하지 마세요.

## 1차 구현 기능

- 플랫폼 선택: KakaoTalk / WeChat / WhatsApp / Telegram
- 사용자 A/B 이름 지정
- 프로필 이미지 업로드
- 대화방 이름 지정
- 대화 날짜 지정: 기본값은 실행 당일
- 시작 시간 지정: 기본값은 실행 시각
- 메시지별 시간 자동 생성
- 날짜는 대화 시작 위치에 1회 표시
- `A:` / `B:` 형식 대화 일괄 입력 및 파싱
- 메시지별 화자 전환 / 텍스트 수정 / 삭제
- OpenAI 기반 영어/일본어 번역
- OpenAI 기반 자연스러운 메신저 문체 보정
- 전문용어/업무 상황 힌트 입력
- 실시간 플랫폼별 Preview
- 현재 화면 PNG 저장
- 전체 대화 Long PNG 저장
- LocalStorage 임시 저장/불러오기
- Mockup 표시 On/Off

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

배포 후 예상 주소:

```text
https://jskimlam.github.io/chat-capture-maker/
```

## Google Apps Script + OpenAI 설정

OpenAI API Key는 프런트엔드나 GitHub 저장소에 넣지 않습니다.

1. Google Apps Script 새 프로젝트를 생성합니다.
2. `gas/Code.gs` 내용을 Apps Script의 `Code.gs`에 붙여넣습니다.
3. **Project Settings → Script Properties**에 다음 값을 추가합니다.
   - `OPENAI_API_KEY` = 본인의 OpenAI API Key
   - `OPENAI_MODEL` = 선택 사항. 기본값 `gpt-5.6-luna`
4. **Deploy → New deployment → Web app**으로 배포합니다.
5. 실행 사용자는 본인, 접근 권한은 앱에서 호출 가능한 범위로 설정합니다.
6. 배포된 `/exec` URL을 Chat Capture Maker의 **API 설정**에 입력합니다.

브라우저에는 GAS Web App URL만 LocalStorage에 저장되며 OpenAI API Key는 저장되지 않습니다.

## 입력 예시

```text
A: 오늘 SM 시장 어때?
B: 중국 내수에서 prompt short covering이 계속 나오고 있어.
A: LG도 이제 들어오나 보네. 금호는 구매 끝난 줄 알았는데.
B: 한국과 일본 쪽 물량이 거의 말라서 필요하면 중국밖에 없을 듯.
```

`A`는 나, `B`는 상대방으로 렌더링됩니다.

## 다음 확장 후보

- 그룹채팅
- Reply / Forward 메시지
- 사진/파일/링크 카드
- 읽음/전송 상태 세부 옵션
- 메시지 단위 시간 수동 보정
- Google Drive PNG 저장
- 프로젝트 DB 저장 및 다시 불러오기
- LINE / iMessage 스타일 추가
