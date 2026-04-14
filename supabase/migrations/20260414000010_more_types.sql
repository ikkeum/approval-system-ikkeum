-- 20260414000010_more_types.sql
-- approvals.type 을 6가지로 확장.

alter table public.approvals
  drop constraint if exists approvals_type_check;

alter table public.approvals
  add constraint approvals_type_check
  check (
    type in (
      'leave',              -- 연차
      'expense',            -- 품의
      'leave_of_absence',   -- 휴직원
      'reinstatement',      -- 복직원
      'employment_cert',    -- 재직증명서
      'career_cert'         -- 경력증명서
    )
  );
