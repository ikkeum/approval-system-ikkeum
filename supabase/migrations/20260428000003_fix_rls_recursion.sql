-- 20260428000003_fix_rls_recursion.sql
-- Phase 2 의 approvals_select / approval_steps_select 정책이 서로 EXISTS 로
-- 참조하면서 infinite recursion 발생.
-- 해결: cross-table 가시성 체크를 SECURITY DEFINER 함수로 분리.
-- 함수 내부의 SELECT 는 RLS 를 우회하므로 정책 재진입이 없다.

-- ============================================================================
-- 1) 헬퍼 함수
-- ============================================================================

create or replace function public.is_step_approver_of(
  p_approval_id bigint,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.approval_steps
    where approval_id = p_approval_id
      and approver_id = p_user_id
  );
$$;

grant execute on function public.is_step_approver_of(bigint, uuid) to authenticated;

create or replace function public.is_visible_approval_for(
  p_approval_id bigint,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.approvals a
    where a.id = p_approval_id
      and (
        a.author_id = p_user_id
        or (a.approver_id = p_user_id and a.status <> 'DRAFT')
        or exists (
          select 1 from public.approval_steps s
          where s.approval_id = a.id
            and s.approver_id = p_user_id
        )
      )
  );
$$;

grant execute on function public.is_visible_approval_for(bigint, uuid) to authenticated;

-- ============================================================================
-- 2) approvals_select 재정의: 직접 컬럼 체크 + 함수
-- ============================================================================

drop policy if exists "approvals_select" on public.approvals;

create policy "approvals_select"
  on public.approvals
  for select
  to authenticated
  using (
    author_id = auth.uid()
    or (approver_id = auth.uid() and status <> 'DRAFT')
    or public.is_step_approver_of(id, auth.uid())
  );

-- ============================================================================
-- 3) approval_steps_select 재정의: 본인 단계 결재자 + 함수
-- ============================================================================

drop policy if exists "approval_steps_select" on public.approval_steps;

create policy "approval_steps_select"
  on public.approval_steps
  for select
  to authenticated
  using (
    approver_id = auth.uid()
    or public.is_visible_approval_for(approval_id, auth.uid())
  );

-- ============================================================================
-- 4) actions_select_visible 재정의: 함수 단일 호출
-- ============================================================================

drop policy if exists "actions_select_visible" on public.approval_actions;

create policy "actions_select_visible"
  on public.approval_actions
  for select
  to authenticated
  using (
    public.is_visible_approval_for(approval_id, auth.uid())
  );
