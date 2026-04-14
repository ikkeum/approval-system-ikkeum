-- seed.sql
-- 로컬 개발용 seed. prod에서는 실행하지 말 것.
-- `supabase db reset`이 자동으로 이 파일을 실행함.

-- 실제 seed는 auth.users에 직접 삽입하면 RLS/trigger가 복잡해지므로,
-- 로컬에서는 Supabase Studio에서 테스트 계정을 수동 생성하고
-- profiles row가 trigger로 만들어지는지 확인하는 것을 권장.

-- 예시(필요 시 주석 해제):
-- insert into public.profiles (id, email, name, dept, role) values
--   ('00000000-0000-0000-0000-000000000001','ceo@example.com','대표','경영지원','admin'),
--   ('00000000-0000-0000-0000-000000000002','lead@example.com','팀장','개발팀','manager'),
--   ('00000000-0000-0000-0000-000000000003','dev@example.com','개발자','개발팀','member');
