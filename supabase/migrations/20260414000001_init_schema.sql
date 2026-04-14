-- 20260414000001_init_schema.sql
-- 사내 전자결재 시스템: 테이블 / 인덱스 / 트리거
-- 주의: 이 파일은 RLS ENABLE 전까지는 데이터 절대 삽입 금지.
--       2단계 마이그레이션(20260414000002_rls_policies.sql) 적용 후부터 사용.

-- ============================================================================
-- 1. profiles (auth.users와 1:1 연결)
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  dept text,
  role text not null default 'member' check (role in ('member','manager','admin')),
  manager_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.profiles is '사내 임직원 정보. auth.users와 1:1. 최초 SSO 로그인 시 trigger가 자동 생성.';

-- ============================================================================
-- 2. approvals (결재 문서: 연차·품의 통합)
-- ============================================================================

create table public.approvals (
  id            bigserial primary key,
  type          text not null check (type in ('leave','expense')),
  title         text not null,
  author_id     uuid not null references public.profiles(id),              -- RESTRICT (이력 보존)
  approver_id   uuid references public.profiles(id),                       -- DRAFT일 때 null 허용
  status        text not null default 'DRAFT'
                check (status in ('DRAFT','PENDING','APPROVED','REJECTED','CANCELED')),
  payload       jsonb not null,                                            -- 앱 레벨 Zod 검증
  attachments   jsonb not null default '[]'::jsonb,                        -- [{path,name,size}]
  created_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  decided_at    timestamptz,
  decision_comment text,
  updated_at    timestamptz not null default now(),
  constraint approver_required_when_submitted
    check (status = 'DRAFT' or approver_id is not null)
);

comment on table public.approvals is '결재 문서. payload는 type별 구조(leave/expense)가 다르며 앱 레이어 Zod로 검증.';

create index idx_approvals_approver_status on public.approvals(approver_id, status);
create index idx_approvals_author_status   on public.approvals(author_id, status);

-- ============================================================================
-- 3. approval_actions (감사 로그)
-- ============================================================================

create table public.approval_actions (
  id           bigserial primary key,
  approval_id  bigint not null references public.approvals(id) on delete cascade,
  actor_id     uuid   not null references public.profiles(id),
  action       text   not null check (action in ('submit','approve','reject','cancel','comment')),
  comment      text,
  created_at   timestamptz not null default now()
);

comment on table public.approval_actions is '결재 액션 히스토리. 추후 감사/정산에 사용.';

create index idx_actions_approval on public.approval_actions(approval_id);

-- ============================================================================
-- 4. trigger: updated_at 자동 갱신
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_approvals_updated_at
  before update on public.approvals
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 5. trigger: auth.users INSERT → profiles 자동 생성
--    (SECURITY DEFINER로 권한 확보)
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- ⚠️ 실제 회사 도메인으로 교체. 여러 개면 array_append 추가.
  allowed_domains text[] := array['idealkr.com', 'ikkeum.com'];
  email_domain text := lower(split_part(new.email, '@', 2));
begin
  if not (email_domain = any (allowed_domains)) then
    raise exception 'email domain not allowed: %', email_domain
      using errcode = '22023';  -- invalid_parameter_value
  end if;

  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

-- Supabase에서는 auth.users에 trigger를 걸 수 있음 (postgres role 권한).
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 6. trigger: approvals 상태 전이 강제 (RLS만으로는 못 막는 시나리오 방어)
-- ============================================================================

create or replace function public.enforce_status_transition()
returns trigger
language plpgsql
as $$
begin
  -- DRAFT 에서 출발: DRAFT 유지 또는 PENDING(제출)만 허용
  if old.status = 'DRAFT' and new.status not in ('DRAFT','PENDING') then
    raise exception 'invalid transition: DRAFT -> %', new.status;
  end if;

  -- PENDING 에서 출발: APPROVED / REJECTED / CANCELED 만 허용
  if old.status = 'PENDING' and new.status not in ('APPROVED','REJECTED','CANCELED') then
    raise exception 'invalid transition: PENDING -> %', new.status;
  end if;

  -- 종결 상태에서는 변경 불가
  if old.status in ('APPROVED','REJECTED','CANCELED') and new.status <> old.status then
    raise exception 'terminal status cannot be changed (% -> %)', old.status, new.status;
  end if;

  -- PENDING 으로 제출되는 순간 submitted_at 채움
  if old.status = 'DRAFT' and new.status = 'PENDING' and new.submitted_at is null then
    new.submitted_at = now();
  end if;

  -- 결정(승인/반려/취소) 시점에 decided_at 자동 채움
  if new.status in ('APPROVED','REJECTED','CANCELED') and new.decided_at is null then
    new.decided_at = now();
  end if;

  return new;
end;
$$;

create trigger trg_enforce_status_transition
  before update of status on public.approvals
  for each row execute function public.enforce_status_transition();
