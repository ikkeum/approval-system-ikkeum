-- 20260612000001_security_hardening.sql
-- 보안 검토(2026-06) 후속: PostgREST 직접 쓰기로 앱 검증을 우회하는 경로 차단.
-- 상세 스펙: docs/specs/security-hardening-202606.md
--
-- ⚠️ 배포 순서: 새 앱 코드(submitAction/check-in/out 의 service_role 전환) 배포 "후" 적용.
--    구 코드가 떠 있는 상태에서 적용하면 기안 제출과 출퇴근 등록이 깨진다.

-- ============================================================================
-- 1) [Critical] 기안자 자가 승인 차단
--    기존 WITH CHECK 가 status 를 제약하지 않아, 기안자가 본인 JWT 로
--    PATCH /rest/v1/approvals { status: 'APPROVED' } 직접 호출이 가능했다.
--    기안자가 직접 쓸 수 있는 상태는 DRAFT(편집)·CANCELED(철회)뿐.
--    제출(DRAFT→PENDING)은 submitAction 이 service_role 로 수행하므로 RLS 무관.
-- ============================================================================

drop policy if exists "approvals_author_update" on public.approvals;

create policy "approvals_author_update"
  on public.approvals
  for update
  to authenticated
  using (
    author_id = auth.uid()
    and status in ('DRAFT','PENDING')
  )
  with check (
    author_id = auth.uid()
    and status in ('DRAFT','CANCELED')
  );

-- ============================================================================
-- 2) [High] 결재자의 approvals 직접 UPDATE 경로 제거
--    1단계 결재자가 RPC 를 우회해 status='APPROVED' 를 직접 써서
--    2단계(대표) 승인을 건너뛸 수 있었다.
--    승인/반려는 advance_approval RPC(SECURITY DEFINER, 단계 검증 포함)만 사용.
-- ============================================================================

drop policy if exists "approvals_approver_decide" on public.approvals;

-- ============================================================================
-- 3) [Critical] approval_steps 기안자 쓰기 정책 제거
--    기존 정책이 FOR ALL 이라, 기안자가 PENDING 문서의 step 행 approver_id 를
--    본인으로 UPDATE 한 뒤 정식 RPC 로 자가 승인할 수 있었다.
--    step 쓰기는 advance_approval RPC 내부와 service_role(submitAction)만 수행.
-- ============================================================================

drop policy if exists "approval_steps_author_write" on public.approval_steps;

-- ============================================================================
-- 4) [High] attendances 직접 쓰기 차단
--    본인 행이면 무엇이든 insert/update 가 가능해, API 라우트의
--    IP·휴일·시각 검증을 우회한 근태 위조가 가능했다.
--    쓰기는 check-in/check-out 라우트(service_role)로만. SELECT 정책은 유지.
-- ============================================================================

drop policy if exists "attendances_insert_own" on public.attendances;
drop policy if exists "attendances_update_own" on public.attendances;

-- ============================================================================
-- 5) [Medium] 팀장 근태 열람 범위를 자기 팀원으로 한정
--    기존: 아무 팀이든 팀장이기만 하면 전 직원 근태 열람 가능.
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
      select 1
      from public.teams t
      join public.profiles p on p.id = p_target_user_id
      where t.leader_id = p_viewer_id
        and p.team_id = t.id
    );
$$;
