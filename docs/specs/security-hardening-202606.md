# 보안 강화 (2026-06): RLS 교정 + IP 추출 + SVG sanitize

> 상태: **[구현완료]**
> 최종 수정: 2026-06-12
> 최종 세션: 2026-06-12 · 에이전트: Claude Code (Fable 5)

## 배경

보안 검토(2026-06-11)에서 발견된 취약점 일괄 수정. 공통 원인: **RLS 정책이 anon key + 본인 JWT 로 PostgREST 에 직접 쓰는 경로를 충분히 제약하지 못함** (앱 라우트/서버 액션의 검증은 우회 가능).

## 기능 목록

| # | 항목 | 상태 | 심각도 |
|---|------|------|--------|
| 1 | 기안자 자가 승인 차단 (approvals_author_update WITH CHECK) | [구현완료] | Critical |
| 2 | 결재자 단계 건너뛰기 차단 (approvals_approver_decide 삭제) | [구현완료] | High |
| 3 | step 행 변조 차단 (approval_steps_author_write 삭제 + submitAction admin 전환) | [구현완료] | Critical |
| 4 | 출퇴근 IP 스푸핑 차단 (lib/ip.ts) | [구현완료] | High |
| 5 | 근태 직접 위조 차단 (attendances 쓰기 정책 삭제 + 라우트 admin 전환) | [구현완료] | High |
| 6 | 직인 SVG 저장형 XSS 차단 (DOMPurify + name 문자 제한) | [구현완료] | High |
| 7 | 팀장 근태 열람 범위를 자기 팀으로 한정 (is_attendance_visible_for) | [구현완료] | Medium |

> ⚠️ 1·2·3·5·7 은 DB 마이그레이션(`20260612000001_security_hardening.sql`) **적용 후** 효력 발생.
> 적용 전까지 코드만 배포된 상태에서는 기존 취약점이 유효하다. 배포 순서: 코드 → 마이그레이션.

## 설계

### 동작

**1. 신규 마이그레이션 `supabase/migrations/20260612000001_security_hardening.sql`** (append-only)

- `approvals_author_update` 재생성:
  - 입력: 기안자의 approvals UPDATE
  - 결과: `WITH CHECK (author_id = auth.uid() AND status IN ('DRAFT','CANCELED'))`
  - 효과: 기안자는 DRAFT 편집과 철회(→CANCELED)만 가능. `status='APPROVED'`/`'PENDING'` 직접 설정 불가
  - 단, 제출(DRAFT→PENDING)은 앱의 submitAction 이 service_role 로 수행하므로 RLS 무관 (아래 3 참조)
- `approvals_approver_decide` 삭제: 결재자의 approvals 직접 UPDATE 경로 제거. 승인/반려는 `advance_approval` RPC(SECURITY DEFINER, 단계 검증 포함)만 사용
- `approval_steps_author_write` 삭제 (대체 정책 없음): 기안자가 step 행의 approver_id/status 를 변조한 뒤 RPC 로 자가 승인하는 경로 차단. step 쓰기는 RPC 내부와 service_role 만 수행
- `attendances_insert_own`, `attendances_update_own` 삭제: PostgREST 직접 쓰기로 IP/휴일/시각 검증을 우회하는 근태 위조 차단. SELECT 정책은 유지
- `is_attendance_visible_for` 재정의: 팀장 분기를 `viewer 가 팀장인 팀에 target 이 소속`일 때만 true (기존: 아무 팀의 팀장이면 전 직원 열람)

**2. `app/(app)/approvals/[id]/actions.ts` — submitAction**

- 입력: 문서 id + picker 선택. 검증(인증, author_id 일치, DRAFT 상태, 템플릿 존재, 결재 라인 해석)은 기존 유저 클라이언트 로직 유지
- 변경: 검증 통과 후의 쓰기 2건(approval_steps INSERT, approvals UPDATE → PENDING)과 실패 시 롤백 DELETE 를 `createAdminClient()`(service_role) 로 수행
- 이유: 1번에서 기안자의 PENDING 직접 설정과 3번에서 step INSERT 권한을 제거했으므로, 제출은 서버 검증을 통과한 경우에만 service_role 로 실행

**3. `lib/ip.ts` — getClientIp**

- 입력: Request 헤더
- 결과: `x-real-ip` 우선 (Vercel 이 직접 세팅, 클라이언트 변조 불가). 폴백은 `x-forwarded-for` 의 **가장 오른쪽** 값 (Vercel 은 수신한 XFF 뒤에 실제 IP 를 append)
- 기존: XFF 가장 왼쪽 값 신뢰 → `curl -H "X-Forwarded-For: <사내IP>"` 로 우회 가능했음

**4. `app/api/attendance/check-in/route.ts`, `check-out/route.ts`**

- 인증·IP 검증·휴일 조회는 기존 유저 클라이언트 유지
- attendances SELECT/INSERT/UPDATE 를 `createAdminClient()` 로 전환 (`user_id` 는 세션의 `user.id` 만 사용)
- 이유: 5번 정책 삭제 후에도 라우트가 동작해야 하며, 쓰기 경로를 "IP 검증을 통과한 라우트"로 일원화

**5. `lib/stamp-svg.ts` (신규) + 렌더 2곳**

- `sanitizeStampSvg(svg)`: 기존 normalizeStampSvg(viewBox 보정) 후 DOMPurify(`isomorphic-dompurify`, SVG 프로파일) 적용. `<script>`, 이벤트 핸들러, `<foreignObject>` 제거
- `app/(app)/profile/StampPanel.tsx:82`, `app/(app)/approvals/[id]/page.tsx:474` 의 `dangerouslySetInnerHTML` 입력을 이 함수로 교체. 중복 정의된 normalizeStampSvg 2곳을 lib 로 통합
- `lib/schemas.ts` SignupInput.name + `app/(app)/admin/members/actions.ts` 의 name 필드: `/^[가-힣a-zA-Z .·-]+$/` 정규식 추가 (직인 텍스트로 들어가는 입력의 문자 화이트리스트)

### 조건/제약

- **마이그레이션은 append-only.** 기존 파일 수정 금지
- **하위 호환(배포 순서)**: 신규 코드는 구 정책에서도 동작(service_role 은 RLS 우회). 구 코드는 신규 정책에서 깨짐(submitAction·check-in 의 유저 클라이언트 쓰기가 차단됨) → **코드 배포 → 마이그레이션 적용** 순서 필수
- 엣지 케이스:
  - 철회: 기안자 PENDING→CANCELED 는 WITH CHECK 의 'CANCELED' 로 계속 허용 (전이 자체는 trigger 가 검증)
  - PENDING→DRAFT 회귀 시도: WITH CHECK 는 통과하나 `enforce_status_transition` trigger 가 차단 (기존 동작 유지)
  - deleteDraftAction: `approvals_delete_own_draft` 정책 유지 + steps 는 FK `on delete cascade` → 영향 없음
  - 자정 넘은 퇴근(어제 행 폴백), 휴일 force 출근: 로직 변경 없음 (클라이언트만 교체)
  - `x-real-ip` 부재(로컬 dev): XFF 폴백 동작. 로컬은 보통 직접 연결이라 XFF 자체가 없으면 null → 차단(안전 기본값)
  - 빈 stamp_svg/null: sanitize 는 빈 문자열 반환
- DOMPurify 는 서버(RSC)·클라이언트 양쪽 렌더에서 동작해야 함 → `isomorphic-dompurify` 사용

### 영향 범위

- `supabase/migrations/20260612000001_security_hardening.sql` (신규)
- `app/(app)/approvals/[id]/actions.ts` (submitAction 쓰기 클라이언트 교체)
- `lib/ip.ts`
- `app/api/attendance/check-in/route.ts`, `app/api/attendance/check-out/route.ts`
- `lib/stamp-svg.ts` (신규), `app/(app)/profile/StampPanel.tsx`, `app/(app)/approvals/[id]/page.tsx`
- `lib/schemas.ts`, `app/(app)/admin/members/actions.ts`
- `package.json` (isomorphic-dompurify, vitest), `vitest.config.ts` (신규), `.github/workflows/ci.yml` (test 단계)

### 완료 기준

- `npm test` 통과: ① getClientIp 스푸핑 시나리오(XFF 왼쪽 주입 무시, x-real-ip 우선) ② sanitizeStampSvg(script/onload/foreignObject 제거, 정상 직인 SVG 보존, viewBox 보정) ③ name 정규식(한글/영문 허용, `<script>` 거부)
- `npm run lint && npm run typecheck && npm run build` 통과
- RLS 변경은 로컬 DB 부재로 자동 테스트 불가 → 배포 후 수동 검증 절차(아래)로 확인

### 배포 후 수동 검증 (Supabase 적용 후)

1. 일반 사용자 토큰으로 `PATCH /rest/v1/approvals?id=eq.<본인 PENDING 문서>` body `{"status":"APPROVED"}` → **RLS 위반으로 0행/에러** 확인
2. 동일 토큰으로 `PATCH /rest/v1/approval_steps?...` → 차단 확인
3. `POST /rest/v1/attendances` 직접 호출 → 차단 확인
4. 정상 플로우 회귀: 기안 제출 → 결재함 표시 → 승인(직인 표시) → 철회 / 출근 → 퇴근
5. `curl -H "X-Forwarded-For: <사내IP>"` 로 외부에서 check-in → 403 확인
6. 팀장 계정으로 타 팀원 `GET /api/attendance?user_id=...` → 빈 결과 확인

## 구현 노트 (Gate 6 대조)

- 스펙과 구현 일치. 추가된 사항:
  - submitAction 의 service_role UPDATE 에 `eq("author_id", user.id).eq("status", "DRAFT")` 조건을 한 번 더 걸어 TOCTOU 창을 축소
  - check-in/out 의 admin UPDATE 에도 `eq("user_id", user.id)` 추가
  - `lib/supabase/admin.ts` 사용 전제 주석을 현행화 (admin 전용 → 검증 완료된 사용자 흐름 포함)
  - 테스트 인프라: vitest + `tests/` 3개 파일(22 케이스), CI 에 `npm run test` 단계 추가
  - vitest 에서 `server-only` 임포트는 `tests/stubs/empty.ts` 로 alias 처리

## 변경 이력

- 2026-06-12: 초기 스펙 작성 (보안 검토 결과 기반)
- 2026-06-12: 구현 완료. 테스트 22/22, lint/typecheck/build 통과, 클라이언트 번들 service_role 누출 0건 확인
