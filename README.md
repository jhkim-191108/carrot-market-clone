# 🥕 당근마켓 클론

Figma 시안을 바탕으로 HTML, CSS, JavaScript로 UI를 구현하고, 제공된 API와 WebSocket으로 상품·회원·채팅을 연동한 당근마켓 클론입니다.

4인 팀 프로젝트이며, 이 저장소에서는 **로그인 / 회원가입 / 마이페이지 / 채팅**을 담당했습니다.

- **저장소**: [github.com/jhkim-191108/carrot-market-clone](https://github.com/jhkim-191108/carrot-market-clone)
- **개발 기간**: 2026.08.13 ~ 2026.08.25
- **인원**: 4명 (팀장: 김지훈)
- **스택**: HTML5, CSS3, Vanilla JS, Node.js, Express, WebSocket

## 프로젝트 소개

이스트소프트 오르미 과정에서 진행한 팀 프로젝트입니다. 디자인 시안을 웹으로 옮기는 것과 동시에, 외부 API를 프록시 서버로 중계해 실제 서비스처럼 동작하게 만드는 것이 목표였습니다.

GitHub로 기능을 나눠 개발하면서 공통 헤더, 인증 쿠키, 반응형 레이아웃을 맞춰 갔습니다.

## 기술 스택

| 구분 | 내용 |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express (정적 파일 + API 프록시) |
| Realtime | WebSocket (`ws`) |
| Auth | HttpOnly 쿠키 (`authToken`), `SameSite=Lax` |
| API | 당근 클론 API, Nominatim (OpenStreetMap) |
| Deploy | Vercel |

- `fetch` + `async/await`로 REST 통신
- 채팅은 REST로 전송하고, 수신은 WebSocket으로 실시간 반영
- CSS Flexbox / Grid, 768px·480px 기준 반응형
- 공통 모달(`appAlert` / `appConfirm`)로 `alert`·`confirm` 대체

## 팀 구성

페이지별 HTML / CSS / JS는 각자 담당했습니다.

| 이름 | 역할 | 담당 |
|---|---|---|
| **김지훈** | 팀장, Git 관리 | **Login, Register, Chat, MyPage** |
| 오수빈 | 서기, README·발표자료 | Onboarding, Location |
| 인마리아 | 진척 관리 | Trade, Trade-post, Write |
| 전재형 | 공통 UI | Common, Header, Search |

---

## 담당 기능 (Login / Register / MyPage / Chat)

### 로그인 · 회원가입

- 로그인(`POST /api/auth/login`)과 회원가입(`POST /api/auth/signup`) 폼을 같은 레이아웃·클래스로 재사용했습니다.
- 아이디 칸 값은 API의 `email` 필드로 보내고, 닉네임·비밀번호 확인은 제출 전에 검증합니다.
- 로그인 성공 시 토큰은 **JS가 만지지 않고** Express가 HttpOnly 쿠키로 저장합니다. XSS로 `localStorage` 토큰이 새는 일을 줄이기 위한 선택입니다.
- 실패/성공 안내는 공통 모달로 띄우고, 가입 후에는 로그인 페이지로, 로그인 후에는 온보딩으로 이동합니다.
- 768px 이하에서는 폼 너비를 화면에 맞추고 여백·글자 크기를 줄였습니다.

### 마이페이지

- `GET /api/auth/me`로 닉네임, 이메일, 지역, 가입일, 프로필 사진을 채웁니다. 비로그인 상태면 로그인 페이지로 보냅니다.
- 닉네임은 `PATCH /api/auth/me`로 수정하고, 지역은 동네인증에서만 바꾸도록 입력칸을 막아 두었습니다.
- 프로필 사진은 카메라 버튼으로 파일을 고른 뒤 `POST /api/images`로 올리고, 받은 URL을 미리보기와 저장 요청에 사용합니다.

### 채팅

- 왼쪽 목록 / 오른쪽 대화창 구조입니다. 목록에는 상대 닉네임, 상품 썸네일, 마지막 메시지, 상대 시간, 안 읽은 개수를 보여줍니다.
- 방 정보는 목록 응답을 재사용하고, 방을 열 때만 메시지 API를 호출해 중복 fetch를 줄였습니다.
- 메시지 전송은 `POST /api/chats/:id/messages`, 수신은 `/ws` WebSocket으로 처리합니다. 열린 방이면 말풍선을 바로 붙이고, 다른 방이면 목록 미리보기와 안 읽은 수만 올립니다.
- ping(20초)과 끊김 후 재연결로 소켓을 유지합니다. 방 전환 시 `join` / `leave` / `read` 이벤트를 보냅니다.
- 같은 사람이 이어서 보낸 메시지는 프로필을 한 번만 그려 메신저처럼 보이게 했습니다.
- 판매자면 거래중 / 예약중 / 거래완료 상태를 바꿀 수 있고, 채팅방 나가기는 확인 모달 후 `DELETE`로 처리합니다.
- 모바일에서는 목록과 대화를 한 화면씩만 보여 주고, 뒤로 가면 목록으로 돌아갑니다.

---

## 그 외 팀 기능

### Header (공통)

로그인 여부에 따라 버튼·동네인증 메뉴를 바꿉니다. 모바일(768px 이하)에서는 검색을 돋보기로 열고, 프로필은 드롭다운(마이페이지 / 채팅 / 로그아웃)입니다.

### Onboarding

히어로·동네 소개·인기매물(상위 8개)을 반응형으로 구성했습니다.

### Location (동네인증)

GPS와 Nominatim으로 시/구/동을 확인하고, 검색한 동네가 현재 위치와 같으면 내 동네로 저장합니다.

### Search / Trade / Write

상품 검색·페이지네이션, 목록 무한 스크롤, 상세·등록·수정·삭제를 API와 연동했습니다. 상세의 **채팅하기**는 채팅방을 만든 뒤 채팅 페이지로 연결됩니다.

## 폴더 구조

```
carrot-market-clone/
├── server.js          # Express. 정적 파일 + API 프록시 + WebSocket 중계
├── html/              # 페이지
├── css/               # 페이지별 스타일 + common / reset / header
├── js/                # 페이지별 스크립트 + header.js, modal.js
├── images/
└── vercel.json
```

## 실행 방법

```bash
npm install
```

프로젝트 루트에 `.env`를 만들고 API 키를 넣습니다.

```
API_KEY=발급받은_키
```

```bash
npm start
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 으로 접속합니다. `/` 는 온보딩으로 이동합니다.

## 반응형

| 구간 | 기준 |
|---|---|
| Desktop | 1200px 초과 |
| Tablet | 768px ~ 1200px |
| Mobile | 480px ~ 768px |
| Small | 480px 이하 |

채팅은 768px 이하에서 목록/대화 화면을 전환합니다.

## 트러블슈팅

- **토큰을 localStorage에 두면 JS에서 읽히는 문제**  
  초기에는 로그인 응답의 토큰을 클라이언트에 저장했습니다. Express 로그인 프록시에서 토큰을 HttpOnly 쿠키로만 심고 응답 body에서는 빼도록 바꿔, 프론트는 `/api/auth/me` 성공 여부로만 로그인 상태를 판단하게 했습니다.

- **채팅 방을 열 때 API가 두 번 호출되던 문제**  
  방 정보와 메시지를 매번 같이 요청하고 있었습니다. 목록 응답을 캐시해 헤더를 그리고, 메시지 목록만 따로 요청하도록 바꿔 중복 호출을 없앴습니다.

- **채팅이 새로고침해야 보이는 문제**  
  REST만 쓰면 상대 메시지가 바로 안 보입니다. 서버의 `/ws`를 당근 API WebSocket에 이어 주고, 클라이언트에서 `message` / `notification`을 구분해 열린 방과 목록을 갱신했습니다.

- **GPS 위치와 검색 위치 비교 오류** (Location)  
  직선거리로 같은 동네인지 보면 넓은 구에서는 오탐이 났습니다. 시/구/동 문자열 비교로 바꿨습니다.

- **헤더 검색이 페이지마다 다르게 동작하던 문제** (Header)  
  페이지마다 헤더 마크업이 달라 submit이 먹지 않았습니다. 공통 헤더 구조로 맞춘 뒤 해결했습니다.

## 브라우저

`fetch`, Cookie, WebSocket, CSS Grid를 사용합니다. 최신 Chrome, Edge, Safari, Firefox에서 확인했습니다.
