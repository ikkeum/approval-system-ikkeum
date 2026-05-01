-- 20260501000001_holidays.sql
-- 공휴일 + 사내 휴일. /attendance 캘린더 표시 및 체크인 차단 용도.
-- source 분리: 'public' = 공공데이터포털 특일정보 자동 시드, 'manual' = 관리자 수기 등록.
-- 공공API 재싱크 시 'public' 행만 교체하여 사내 휴일('manual')은 보존.

create table if not exists public.holidays (
  date date primary key,
  name text not null,
  source text not null
    check (source in ('public', 'manual'))
    default 'manual',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.holidays is
  '공휴일/사내 휴일. source=public 은 공공API 시드, manual 은 관리자 등록.';

create index holidays_date_idx on public.holidays (date);

create trigger trg_holidays_updated_at
  before update on public.holidays
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.holidays enable row level security;

-- SELECT: 모든 인증 사용자 (캘린더 / 체크인 클라이언트 표시용)
create policy "holidays_select_all"
  on public.holidays
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE: 대표(role='admin') 만
create policy "holidays_insert_admin"
  on public.holidays
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "holidays_update_admin"
  on public.holidays
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

create policy "holidays_delete_admin"
  on public.holidays
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
