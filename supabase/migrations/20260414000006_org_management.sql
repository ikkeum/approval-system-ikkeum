-- 20260414000006_org_management.sql
-- handle_new_user trigger 확장: admin 초대 시 metadata(dept, role, manager_id) 반영.
-- 기존 자체 signup 경로도 그대로 작동 (metadata 비면 기본값).
-- 주석

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
  if v_role not in ('member','manager','admin') then
    v_role := 'member';
  end if;

  -- manager_id 는 UUID. 형식이 잘못되면 조용히 null.
  begin
    v_manager_id := nullif(new.raw_user_meta_data->>'manager_id', '')::uuid;
  exception when others then
    v_manager_id := null;
  end;

  insert into public.profiles (id, email, name, dept, role, manager_id)
  values (new.id, new.email, v_name, v_dept, v_role, v_manager_id);

  return new;
end;
$$;
