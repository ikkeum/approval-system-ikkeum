-- 20260504000001_attendance_correction.sql
-- "근무시각 조정 신청" 결재 문서 추가 + 반자동 적용 인프라.
-- 결재 승인 후 admin 이 별도 적용 액션을 거쳐야 attendances 가 변경된다.
-- 적용 이력은 attendance_correction_applications 로 추적한다.

-- ============================================================================
-- 1) approvals.type enum 확장
-- ============================================================================

alter table public.approvals
  drop constraint if exists approvals_type_check;

alter table public.approvals
  add constraint approvals_type_check
  check (
    type in (
      'leave',
      'expense',
      'leave_of_absence',
      'reinstatement',
      'employment_cert',
      'career_cert',
      'attendance_correction'
    )
  );

-- ============================================================================
-- 2) document_templates 시드
-- ============================================================================

insert into public.document_templates (key, name, short_name, sort_order, schema, chain, title_template)
values
  ('attendance_correction', '근무시각 조정 신청', '근무조정', 25,
   $$[
     {"kind":"date","name":"correction_date","label":"정정 대상일","required":true},
     {"kind":"row","children":[
       {"kind":"text","name":"check_in_time","label":"정정 후 출근 (HH:MM)","required":false,"maxLength":5,"placeholder":"09:00"},
       {"kind":"text","name":"check_out_time","label":"정정 후 퇴근 (HH:MM)","required":false,"maxLength":5,"placeholder":"18:00"}
     ]},
     {"kind":"textarea","name":"reason","label":"정정 사유","required":true,"rows":3,"maxLength":500}
   ]$$::jsonb,
   $$[
     {"index":1,"label":"기안","mode":"author"},
     {"index":2,"label":"결재","mode":"picker"}
   ]$$::jsonb,
   '근무시각 조정 ({{correction_date}})'
  )
on conflict (key) do nothing;

-- ============================================================================
-- 3) attendance_correction_applications: 적용 이력
-- ============================================================================

create table if not exists public.attendance_correction_applications (
  approval_id bigint primary key references public.approvals(id) on delete cascade,
  applied_at  timestamptz not null default now(),
  applied_by  uuid not null references public.profiles(id) on delete set null
);

comment on table public.attendance_correction_applications is
  '근무시각 조정 결재의 attendances 반영 이력. PK 가 approval_id 라 중복 적용 불가.';

-- ============================================================================
-- 4) RLS
-- ============================================================================

alter table public.attendance_correction_applications enable row level security;

-- SELECT: admin 만 (목록 페이지에서 적용/미적용 확인용)
create policy "attendance_correction_applications_select_admin"
  on public.attendance_correction_applications
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- INSERT/UPDATE/DELETE 정책 미작성 → service_role(createAdminClient) 로만 처리.
-- 이 테이블 변경은 반드시 apply-correction API 를 거쳐야 audit 이 일관된다.
