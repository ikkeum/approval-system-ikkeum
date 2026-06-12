# AGENTS.md

## Spec-Driven 설정
REQUIRED SKILL: spec-driven-development

### 코드-스펙 매핑

| 코드 경로 | 스펙 경로 | changelog |
|----------|----------|-----------|
| `app/`, `lib/`, `components/`, `middleware.ts` | `docs/specs/` | `docs/CHANGELOG.md` |
| `supabase/migrations/` | `docs/specs/` | `docs/CHANGELOG.md` |

### 공통
- 상태 태그: `[구현중]`, `[구현완료]`
- 검증: `npm run lint && npm run typecheck && npm run build` (+ 테스트 존재 시 `npm test`)

## 프로젝트 규칙

- 마이그레이션은 **append-only**: 기존 파일 수정 금지, 신규 파일 추가만 허용
- 브랜치 전략: `feature/* → dev → main` (PR 경유)
- 커밋 컨벤션: 한글 conventional commits (`feat(scope): ...`)
- `SUPABASE_SERVICE_ROLE_KEY` 는 서버 전용 (`lib/supabase/admin.ts` 경유, `import "server-only"` 필수)
- 승인/반려 상태 전이는 `advance_approval` RPC 단일 경로. 클라이언트(anon key) 직접 UPDATE 로 결재 상태를 바꾸는 코드 추가 금지
- `attendances` 쓰기는 service_role 경유 API 라우트로만 (RLS 직접 쓰기 차단됨)
- DB 에 저장된 SVG(`profiles.stamp_svg`)를 렌더할 때는 반드시 `lib/stamp-svg.ts` 의 sanitize 경유
