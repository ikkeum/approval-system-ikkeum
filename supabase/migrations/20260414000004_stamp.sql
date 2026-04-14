-- 20260414000004_stamp.sql
-- 개인 직인(SVG) 저장. 가입 시 1회 생성 후 profiles에 저장, 결재 승인/반려 시 렌더링.

alter table public.profiles
  add column if not exists stamp_svg text;

comment on column public.profiles.stamp_svg is
  '개인 직인 SVG (sign-generator로 생성). 이름 기반으로 가입 후 자동 생성.';

-- 주의: profiles_self_update 정책이 이미 본인 row의 UPDATE를 허용하므로
--       사용자 본인이 자신의 stamp_svg를 생성/갱신 가능. 추가 정책 불필요.
