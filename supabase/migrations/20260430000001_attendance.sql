-- 20260430000001_attendance.sql
-- 근태(출퇴근) 관리. 사내 IP 화이트리스트 기반 체크인/아웃 + 캘린더 조회.
-- 가시성: 본인 + 대표(role='admin') + 팀장(teams.leader_id).
-- 기준 시간대: Asia/Seoul (지각 판정 / work_date 계산은 API 레이어 책임).

-- ============================================================================
-- 1) attendance_settings (싱글톤)
-- ============================================================================

create table if not exists public.attendance_settings (
  id smallint primary key default 1,
  late_threshold time not null default '09:00:00',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint attendance_settings_singleton check (id = 1)
);

comment on table public.attendance_settings is
  '근태 전역 설정 (싱글톤). late_threshold 초과 출근 = 지각.';

insert into public.attendance_settings (id, late_threshold)
values (1, '09:00:00')
on conflict (id) do nothing;

create trigger trg_attendance_settings_updated_at
  before update on public.attendance_settings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2) attendances
-- ============================================================================

create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_ip inet,
  check_out_ip inet,
  is_late boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

create index attendances_user_date_idx
  on public.attendances (user_id, work_date desc);

create index attendances_work_date_idx
  on public.attendances (work_date desc);

comment on table public.attendances is
  '출퇴근 기록. (user_id, work_date) 유니크. work_date 는 KST 기준 날짜.';

create trigger trg_attendances_updated_at
  before update on public.attendances
  for each row execute function public.set_updated_at();

-- is_late 자동 계산: check_in_at 의 KST 시각 vs late_threshold
create or replace function public.compute_is_late()
returns trigger
language plpgsql
as $$
declare
  v_threshold time;
begin
  if new.check_in_at is null then
    new.is_late := false;
    return new;
  end if;

  select late_threshold into v_threshold
    from public.attendance_settings where id = 1;

  new.is_late := (new.check_in_at at time zone 'Asia/Seoul')::time
                 > coalesce(v_threshold, '09:00:00'::time);
  return new;
end;
$$;

create trigger trg_attendances_compute_is_late
  before insert or update of check_in_at on public.attendances
  for each row execute function public.compute_is_late();

-- ============================================================================
-- 3) Helper: 가시성 체크 (RLS 재귀 회피용 SECURITY DEFINER)
-- ============================================================================

create or replace function public.is_attendance_visible_for(
  p_target_user_id uuid,
  p_viewer_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    p_target_user_id = p_viewer_id
    or exists (
      select 1 from public.profiles
      where id = p_viewer_id and role = 'admin'
    )
    or exists (
      select 1 from public.teams
      where leader_id = p_viewer_id
    );
$$;

grant execute on function public.is_attendance_visible_for(uuid, uuid) to authenticated;

-- ============================================================================
-- 4) RLS
-- ============================================================================

alter table public.attendances enable row level security;
alter table public.attendance_settings enable row level security;

-- attendances: SELECT — 본인 OR 대표 OR 팀장
create policy "attendances_select"
  on public.attendances
  for select
  to authenticated
  using (
    public.is_attendance_visible_for(user_id, auth.uid())
  );

-- attendances: INSERT — 본인만
create policy "attendances_insert_own"
  on public.attendances
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- attendances: UPDATE — 본인만
create policy "attendances_update_own"
  on public.attendances
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- attendance_settings: SELECT — 모든 인증 사용자 (지각 기준 노출)
create policy "attendance_settings_select_all"
  on public.attendance_settings
  for select
  to authenticated
  using (true);

-- attendance_settings: UPDATE — 대표(role='admin')만
create policy "attendance_settings_update_admin"
  on public.attendance_settings
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
