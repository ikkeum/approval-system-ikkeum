-- 20260414000009_teams.sql
-- 팀 테이블 + profiles.team_id. 결재 라우팅:
--   팀원 submit → approver = 팀의 leader
--   팀장/무소속 submit → approver = 대표
-- 추후 3단 결재(사직서/인재추천서 등)는 별도 approval_chain 필드로 확장 예정.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  leader_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.teams is '조직 팀. leader_id = 팀장 (결재자 후보).';

create trigger trg_teams_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

alter table public.profiles
  add column if not exists team_id uuid references public.teams(id) on delete set null;

comment on column public.profiles.team_id is '소속 팀. null 이면 무소속 (결재 시 대표로 라우팅).';

-- handle_new_user: metadata 의 team_id 추가 반영
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_domains text[] := array['idealkr.com', 'ikkeum.com'];
  email_domain text := lower(split_part(new.email, '@', 2));
  v_name text;
  v_dept text;
  v_role text;
  v_manager_id uuid;
  v_hire_date date;
  v_team_id uuid;
begin
  if not (email_domain = any (allowed_domains)) then
    raise exception 'email domain not allowed: %', email_domain
      using errcode = '22023';
  end if;

  v_name := coalesce(
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1)
  );
  v_dept := nullif(new.raw_user_meta_data->>'dept', '');
  v_role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'member');
  if v_role not in ('member','manager','admin') then v_role := 'member'; end if;

  begin
    v_manager_id := nullif(new.raw_user_meta_data->>'manager_id', '')::uuid;
  exception when others then v_manager_id := null; end;

  begin
    v_hire_date := nullif(new.raw_user_meta_data->>'hire_date', '')::date;
  exception when others then v_hire_date := null; end;

  begin
    v_team_id := nullif(new.raw_user_meta_data->>'team_id', '')::uuid;
  exception when others then v_team_id := null; end;

  insert into public.profiles (id, email, name, dept, role, manager_id, hire_date, team_id)
  values (new.id, new.email, v_name, v_dept, v_role, v_manager_id, v_hire_date, v_team_id);

  return new;
end;
$$;

-- RLS
alter table public.teams enable row level security;

-- 모든 인증 사용자가 팀 목록 조회 가능 (신청 시 팀명/팀장 표시용)
create policy "teams_read_all_authenticated"
  on public.teams
  for select
  to authenticated
  using (true);

-- 쓰기는 admin service_role 로만 (앱 레벨에서 admin 검증 후 service_role 사용)
-- → INSERT/UPDATE/DELETE policy 미작성 시 authenticated 역할은 기본 거부
