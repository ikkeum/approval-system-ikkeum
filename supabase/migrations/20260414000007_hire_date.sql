-- 20260414000007_hire_date.sql
-- 입사일 컬럼 + trigger에서 metadata의 hire_date 반영.
-- 잔여 연차 산정 기반.

alter table public.profiles
  add column if not exists hire_date date;

comment on column public.profiles.hire_date is
  '입사일. 근속 연수 산정 → 잔여 연차 계산의 기준.';

-- handle_new_user 재정의 (기존 006에서 이어 확장)
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
  exception when others then
    v_manager_id := null;
  end;

  begin
    v_hire_date := nullif(new.raw_user_meta_data->>'hire_date', '')::date;
  exception when others then
    v_hire_date := null;
  end;

  insert into public.profiles (id, email, name, dept, role, manager_id, hire_date)
  values (new.id, new.email, v_name, v_dept, v_role, v_manager_id, v_hire_date);

  return new;
end;
$$;
