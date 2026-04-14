# 사내 전자결재 (Ikkeum Approval)

사내 전용 전자결재 시스템. Next.js + Supabase 기반. Vercel · Supabase 무료 티어 안에서 10명 규모 팀을 커버하도록 설계됨.

## 주요 기능

- **6종 기안 문서**: 연차 / 품의 / 휴직원 / 복직원 / 재직증명서 / 경력증명서
- **2단계 결재**: 본인(기안) → 팀장 또는 대표. 팀 라우팅에 따라 자동 결정
- **팀 조직**: 팀 CRUD, 팀장 1명, 소속 멤버 1:N
- **개인 직인 생성·적용**: 가입 시 이름 기반 SVG 직인(전서체) 자동 생성. 승인 시 각 단계 카드에 도장 표시
- **관리자 기능**:
  - 이메일 초대 (Supabase Auth admin.inviteUserByEmail)
  - 멤버 부서 · 팀 · 역할 · 입사일 · 대표 지정 편집
  - 팀 CRUD
- **이메일 도메인 화이트리스트**: `handle_new_user` trigger 에서 강제 (현재 `idealkr.com` / `ikkeum.com`)
- **결재자 보기**: 결재함(내가 결재자인 문서) · 내 문서(내가 기안한 문서) 분리
- **감사 이력**: 모든 상태 전이가 `approval_actions` 에 자동 기록 (DB trigger)

## 스택

| 레이어 | 선택 |
|---|---|
| Frontend | Next.js 15 App Router + React 19 (TypeScript) |
| Auth · DB · Storage | Supabase (Postgres, Auth, Storage) |
| 호스팅 | Vercel (Hobby 티어) |
| 직인 생성 | `sign-generator` + MaruBuri 폰트 (Node 런타임) |
| 스키마 검증 | Zod |

## 디렉터리 구조

```
approval-process/
├── app/
│   ├── (app)/                          인증된 사용자 레이아웃 (사이드바 포함)
│   │   ├── dashboard/                   대시보드 (요약 + 최근)
│   │   ├── approvals/
│   │   │   ├── page.tsx                 결재함 (승인자 관점)
│   │   │   ├── new/                     기안 작성 (type 별 폼 dispatch)
│   │   │   └── [id]/                    문서 상세 + 결재 액션
│   │   ├── mydocs/                      내 문서
│   │   ├── profile/                     프로필 + 직인
│   │   └── admin/
│   │       ├── members/                 멤버 CRUD + 이메일 초대
│   │       └── teams/                   팀 CRUD
│   ├── login/ signup/                   공개 페이지
│   ├── auth/                            confirm / callback / signout
│   └── api/stamp/                       직인 생성 Route Handler
├── components/                          공용 컴포넌트 (Sidebar, RoleBadge, StatusBadge, NewApprovalMenu 등)
├── lib/
│   ├── supabase/                        client / server / middleware / admin (service_role)
│   ├── approvals.ts                     타입·상태·라벨 상수
│   ├── schemas.ts                       Zod 스키마 (type 별 payload)
│   ├── stamp.ts                         sign-generator 래퍼
│   └── format.ts                        날짜·금액 포맷
├── middleware.ts                        전역 세션 갱신 + 라우트 보호
├── supabase/
│   ├── migrations/                      순서 적용 필수 (001 → 010)
│   ├── seed.sql
│   └── README.md                        Day 1 OAuth → Day 2 DB 셋업 가이드
├── fonts/                               직인용 TTF (커밋 제외, README 참고)
├── public/                              로고·심볼 이미지
├── DESIGN.md                            초안 설계 문서
├── TODOS.md                             향후 개선 계획 (문서 템플릿 CRUD)
└── README.md
```

## 로컬 개발 셋업

### 전제

- Node.js 20+ (또는 22)
- Supabase 프로젝트 (무료 티어 2개: staging / prod 권장)
- 이메일 SMTP 는 Supabase 기본 제공 (시간당 3건 제한 → 프로덕션은 Resend 등 연동 권장)

### 1. 의존성 설치

```bash
npm install
# sign-generator 가 2022 패키지라 peer 경고 시:
# npm install --legacy-peer-deps
```

### 2. 환경변수

```bash
cp .env.local.example .env.local
# 아래 값 채우기:
#   NEXT_PUBLIC_SUPABASE_URL       = https://<프로젝트ref>.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY  = <anon key>
#   NEXT_PUBLIC_SITE_URL           = http://localhost:3000
#   SUPABASE_SERVICE_ROLE_KEY      = <service_role key>  ⚠️ 서버 전용
#   GOOGLE_CHAT_WEBHOOK_URL        = (Day 5 알림, 선택)
```

값은 Supabase Dashboard → Project Settings → API 에서 복사.

### 3. DB 마이그레이션 적용

Supabase Dashboard → SQL Editor 에서 `supabase/migrations/` 의 `.sql` 파일을 **숫자 순서대로** 실행:

```
20260414000001_init_schema.sql       테이블 + 인덱스 + 기본 trigger
20260414000002_rls_policies.sql      ⚠️ 데이터 삽입 전 필수
20260414000003_storage.sql           Storage 버킷 + 정책
20260414000004_stamp.sql             profiles.stamp_svg
20260414000005_action_log.sql        액션 자동 로깅
20260414000006_org_management.sql    handle_new_user 확장
20260414000007_hire_date.sql         입사일 컬럼
20260414000008_two_step_approval.sql 2단계 결재 + RPC
20260414000009_teams.sql             팀 테이블 + 라우팅
20260414000010_more_types.sql        문서 유형 6종 확장
```

또는 Supabase CLI:
```bash
supabase link --project-ref <ref>
supabase db push
```

### 4. 폰트 배치 (직인 생성용)

`fonts/README.md` 참고. 현재 코드는 `fonts/MaruBuri.ttf` 를 찾습니다.

```bash
# 네이버 한글한글 아름답게에서 MaruBuri 다운로드 후:
cp ~/Downloads/MaruBuri-Regular.ttf fonts/MaruBuri.ttf
```

### 5. 개발 서버

```bash
npm run dev
# http://localhost:3000 접속
```

### 6. 초기 셋업 플로우

1. `/signup` 에서 허용된 회사 이메일로 가입 → 확인 메일 클릭 → 로그인
2. **Supabase SQL Editor** 에서 본인을 admin 으로 승격:
   ```sql
   update public.profiles set role = 'admin' where email = '<내 이메일>';
   ```
3. `/profile` 에서 직인 생성
4. `/admin/members` 에서 팀원 초대 + **대표(1명) 지정**
5. `/admin/teams` 에서 팀 만들고 팀장 지정 + 멤버 소속 배치
6. 일반 사용자가 `+ 기안 작성` 으로 문서 제출 테스트

## 결재 라우팅 규칙

| 작성자 | 1단계(기안) | 2단계(결재) |
|---|---|---|
| 팀원 (team_id 있음, 팀장 아님) | 본인(자동) | **소속 팀의 팀장** |
| 팀장 (team.leader_id = self) | 본인(자동) | **대표 (is_executive=true)** |
| 무소속 (team_id null) | 본인(자동) | **대표** |
| 본인 = 결재자 (self-loop) | — | 에러 |

상태 전이: `DRAFT → PENDING → APPROVED|REJECTED|CANCELED`. `enforce_status_transition` trigger 가 잘못된 전이를 차단.

## 주요 스크립트

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run start      # 프로덕션 서버
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

## 배포 (Vercel)

요약:
1. GitHub 레포 푸시
2. Vercel Import → Framework 자동 인식 (Next.js)
3. 환경변수 4개 등록 (Production + Preview)
4. 배포 후 실제 URL 확인 → `NEXT_PUBLIC_SITE_URL` 업데이트 → 재배포
5. **Supabase Dashboard → Authentication → URL Configuration**
   - Site URL: `https://<프로젝트>.vercel.app`
   - Redirect URLs: `https://<프로젝트>.vercel.app/**`, `https://*.vercel.app/**`

폰트 파일은 `.gitignore` 에 등록돼 있으므로 Vercel 에 반영하려면:
```bash
echo '!fonts/MaruBuri.ttf' >> .gitignore
git add fonts/MaruBuri.ttf .gitignore && git commit -m "chore: include stamp font"
```

## 보안 체크리스트 (배포 전)

- [ ] 모든 테이블 RLS ENABLE (001 직후 002 적용됐는지)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` 이 의도한 프로젝트인지
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 가 Production 환경에만 설정됐는지
- [ ] Next.js 번들에 `service_role` 문자열 검색 → 0건
- [ ] 도메인 화이트리스트(`handle_new_user` 의 `allowed_domains`)가 실제 회사 도메인
- [ ] gmail.com 으로 가입 시도 → 거부 확인
- [ ] 팀원 A 로그인 상태에서 팀원 B 의 approval ID 로 직접 접근 → 404 확인

## 알려진 한계

- 결재 라인은 2단계 고정. 3단계 이상(사직서·인재추천서 등)은 템플릿 시스템 도입 후 지원 (`TODOS.md` 참고)
- 연차 잔여일수 자동 계산 없음. 입사일 컬럼은 DB 에만 저장
- 대표 변경 시 기존 PENDING 건의 `second_approver_id` 는 스냅샷 유지 (의도된 동작)
- 이메일 도메인 화이트리스트는 trigger 하드코딩. 동적 변경은 함수 `create or replace` 필요
- 멤버 삭제 기능 없음 (감사 이력 보존 목적, 추후 `deactivated_at` 도입 예정)

## 관련 문서

- [`DESIGN.md`](./DESIGN.md) — 초안 설계 (office-hours 세션 산출물)
- [`TODOS.md`](./TODOS.md) — 문서 템플릿 CRUD 로의 리팩토링 계획
- [`supabase/README.md`](./supabase/README.md) — DB 셋업 + 어드민 부트스트랩
- [`fonts/README.md`](./fonts/README.md) — 직인 폰트 라이선스 및 다운로드

## 기여

내부 프로젝트로 현재는 단일 저장소 운영. 변경 시 마이그레이션은 **append-only** (기존 파일 수정 대신 신규 파일 추가).
