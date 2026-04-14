# 직인용 폰트

sign-generator가 사용하는 TTF 폰트 파일을 이 디렉터리에 둡니다.
`lib/stamp.ts`가 아래 파일명을 순서대로 탐색합니다(첫 번째 발견한 것 사용).

- `MISEANG.ttf`  (네이버 미생체) ← 권장, 상업 이용 가능
- `GODOMAUM.ttf` (고도 마음체) ← 대체
- `TVN.ttf`      (tvN체) ← 대체

## 다운로드 (각 배포처 공식 링크)

- 미생체: https://hangeul.naver.com/font (네이버 한글한글 아름답게 → 나눔/클로바 섹션에서 미생)
- 고도 마음체: https://font.gomin.com (고도몰)
- tvN체: https://tvn.tving.com/tvn/tvnfont

## 라이선스 주의

- 폰트 파일은 각자 사용자가 공식 사이트에서 다운로드해 **본 디렉터리에 배치**.
- 이 저장소에는 커밋하지 않는 것을 권장(`.gitignore` 등록 검토).
- 사내 배포 시 폰트 라이선스 조항(상업적 이용, 재배포 금지 등)을 반드시 확인.

## 설치 후 확인

```bash
ls fonts/*.ttf
# 하나라도 있으면 lib/stamp.ts가 사용
```

폰트 없이 `/api/stamp` 를 호출하면 500 에러에 다운로드 안내 메시지가 반환됩니다.
