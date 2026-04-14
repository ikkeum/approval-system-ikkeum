# Supabase Setup — Day 1 & Day 2

DESIGN.md의 Day 1 (인증) + Day 2 (DB) 단계용 문서.
**인증 방식**: v1은 이메일/비번 + 도메인 화이트리스트. Google SSO는 GWS Admin 확보 후 전환.

## Day 1 — 이메일 인증 설정

1. **Supabase Dashboard → Authentication → Providers**
   - **Email**: Enabled (기본 ON)
   - **Confirm email**: ON 권장 (오타 방지 + 실제 수신 가능 확인)
   - **Secure password change**: ON
   - **Google / 기타 provider**: OFF (나중에 전환)

2. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (Day 3부터)
   - Redirect URLs: `http://localhost:3000/**`, 배포 후 `https://<vercel-domain>/**` 추가

3. **Authentication → Email Templates** (선택, 한글화)
   - Confirm signup / Reset password / Magic link 템플릿을 한글로 수정
   - 발신자: 기본 `noreply@mail.app.supabase.io` 유지 (Free 티어 SMTP). Resend 연동은 추후.

4. **도메인 화이트리스트** — DB trigger로 강제
   - `migrations/20260414000001_init_schema.sql` 의 `handle_new_user()` 함수 안
     `allowed_domains` 배열을 **실제 회사 도메인**으로 교체:
     ```sql
     allowed_domains text[] := array['회사도메인.com'];
     ```
   - 도메인 여러 개면: `array['회사도메인.com', '자회사도메인.com']`
   - 적용 방식: 마이그레이션 편집 → 재적용(아직 배포 전이므로 가능) 또는
     이미 적용 후라면 SQL Editor에서 `create or replace function` 으로 덮어쓰기

5. **스모크 테스트** — Day 2 마이그레이션 적용 후
   - gmail.com 이메일로 signup 시도 → 에러 메시지 (`email domain not allowed`)
   - 회사 도메인 이메일로 signup → confirmation 메일 수신 → `public.profiles` row 자동 생성 ✅

### Google SSO 전환 (추후, GWS Admin 확보 시)

1. Google Cloud Console에서 OAuth 클라이언트 생성
2. Supabase → Providers → Google 활성화 + Client ID/Secret 입력
3. 로그인 UI에 "Google로 로그인" 버튼 추가 시 `queryParams: { hd: '회사도메인.com' }` 전달
4. 기존 이메일 계정은 같은 이메일로 Google 로그인하면 자동 병합됨 (Supabase 기본 동작)
5. DB 쪽 `handle_new_user` trigger는 그대로 작동 (이메일 도메인 체크는 auth provider와 무관)

## Day 2 — DB 마이그레이션

### 로컬 개발 (Supabase CLI)

```bash
# CLI 설치 (없다면)
brew install supabase/tap/supabase

# 프로젝트 초기화 (이미 supabase/ 있으면 link만)
supabase link --project-ref <STAGING_PROJECT_REF>

# 로컬에서 테스트
supabase start
supabase db reset   # migrations/ 전체 적용

# staging에 push
supabase db push
```

### 수동 적용 (CLI 없이)

Supabase Dashboard → SQL Editor에서 파일 순서대로 실행:

1. `20260414000001_init_schema.sql`  (테이블 + 인덱스 + trigger)
2. `20260414000002_rls_policies.sql` (**⚠️ 데이터 삽입 전에 반드시**)
3. `20260414000003_storage.sql`      (Storage 버킷 + 정책)

### 적용 후 체크 (1분)

```sql
-- 모든 테이블이 RLS 켜져있는지
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname in ('public','storage') and tablename in
  ('profiles','approvals','approval_actions','objects');
-- rowsecurity = true 여야 함

-- 정책 개수 체크 (최소 10개: profiles 2, approvals 5, actions 2, storage 3)
select schemaname, tablename, count(*)
from pg_policies
where schemaname in ('public','storage')
group by 1,2 order by 1,2;

-- trigger 확인
select tgname from pg_trigger where tgname like 'trg_%' or tgname = 'on_auth_user_created';
-- trg_approvals_updated_at / trg_enforce_status_transition / on_auth_user_created 3개
```

### 첫 로그인 smoke test

1. Next.js 앱이 아직 없어도 Supabase Dashboard → Authentication → Users 에서 실제 GWS 계정으로 로그인 테스트
2. `public.profiles` 테이블에 row 자동 생성되었는지 확인
3. 없으면 `handle_new_user` trigger 문제. `select * from auth.users;`로 raw_user_meta_data 확인.

## 환경변수 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
# ⚠️ 아래는 서버 전용. Edge Function / Next.js Route Handler에서만.
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
COMPANY_DOMAIN=회사도메인.com
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/...
```

`SUPABASE_SERVICE_ROLE_KEY`는 **절대 `NEXT_PUBLIC_` prefix 금지**. 번들에 들어가면 RLS 전부 우회됨.

## 다음 단계 (Day 3~)

- Next.js App Router 스캐폴딩
- `@supabase/ssr` 설정 + middleware
- `/login` + Google SSO 버튼
- 실제 로그인 → profiles row 자동 생성 확인

## 첫 admin 지정 (bootstrap)

자체 signup으로 첫 계정을 만든 뒤, Supabase SQL Editor에서 role을 admin으로 승격:

```sql
update public.profiles
set role = 'admin'
where email = 'dykim@ikkeum.com';  -- 실제 본인 이메일로 교체
```

그 뒤 웹에서 로그인하면 사이드바에 "조직 관리" 메뉴가 나타나고, 멤버 초대 가능.
