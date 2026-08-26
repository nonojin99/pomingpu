# 내친구 포밍뿌 (Godot 아님 — HTML + PWA + Capacitor)

포롱이·밍뚜·뿌비 키우기 게임. 웹(PWA)이 본체, 안드로이드는 Capacitor로 APK 랩핑.

## 구조
```
index.html            화면 마크업 (선택 / 홈)
css/style.css         스타일
js/engine.js          순수 함수 틱 엔진 — 시간 진행·스탯·액션·마이그레이션 (DOM 금지)
js/app.js             UI 바인딩, localStorage 저장, 오프라인 경과 반영, SW 등록
sw.js                 서비스 워커 (오프라인 캐시)
manifest.webmanifest  PWA 매니페스트
capacitor.config.json Capacitor 설정 (안드로이드 랩핑용)
assets/               캐릭터 이미지(512px 최적화) + 앱 아이콘
```

## 로컬 실행
아무 정적 서버면 됨 (Service Worker 때문에 file:// 말고 http로):
```
python -m http.server 8080   # 후 http://localhost:8080
```

## GitHub Pages 배포
1. 이 폴더를 GitHub 저장소에 push (예: `pomingpu-app`)
2. Settings → Pages → Source: `main` / root
3. `https://nonojin99.github.io/pomingpu-app/` 접속

## 아이폰에서 설치 (PWA)
Safari로 접속 → 공유 버튼 → **홈 화면에 추가**. 전체화면 앱처럼 실행되고 오프라인도 동작.

## 안드로이드 APK 빌드 (로컬 PC, 처음 한 번 셋업)
필요: Node.js, Android Studio(SDK 포함), JDK 17
```
npm install
npx cap add android      # android/ 폴더 생성 (gitignore됨)
npx cap sync             # 웹 파일을 android로 복사 — 웹 수정할 때마다 실행
npx cap open android     # Android Studio 열기
```
Android Studio에서 Build → Build APK(s) → 생성된 `app-debug.apk`를 폰에 옮겨 설치
(설정에서 "출처를 알 수 없는 앱 설치" 허용 필요)

## M0 검증 체크리스트
- [ ] 브라우저에서 캐릭터 선택 → 홈 화면 진입
- [ ] 케어 액션 6종 동작 (쿨다운·아이템 수량·풀스탯 거부 포함)
- [ ] 새로고침해도 상태 유지 (localStorage)
- [ ] 탭을 닫았다 오래 후 다시 열면 스탯이 깎여 있음 (하한 30, 최대 8시간 반영)
- [ ] 3시간+ 방치 후 복귀 시 "보고 싶었어" + 복귀 선물
- [ ] 폰 브라우저에서 홈 화면에 추가(PWA) 가능

## 마일스톤
M0 뼈대(현재) → M1 엔진 테스트 → M2 홈 화면 완성 → M3 성장·분기·도감 → M4 상점·미니게임·소풍 → M5 Supabase 클라우드 세이브 → M6 폴리시·APK
