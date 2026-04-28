-- 20260428000002_advance_approval_v2.sql
-- Phase 2: advance_approval을 approval_steps 기반 N단계로 재작성.
-- + 다단계 결재자가 본인이 거친(또는 다가올) 단계의 문서를 SELECT 할 수 있게 RLS 확장.

-- ============================================================================
-- 1) advance_approval RPC 재작성
-- ============================================================================

create or replace function public.advance_approval(
  p_id      bigint,
  p_action  text,    -- 'approve' | 'reject'
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user          uuid := auth.uid();
  v_status        text;
  v_current_step  int;
  v_total_steps   int;
  v_step_approver uuid;
  v_next_step     int;
  v_next_approver uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select status, current_step, total_steps
    into v_status, v_current_step, v_total_steps
  from public.approvals
  where id = p_id
  for update;

  if not found then
    raise exception '문서를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_status <> 'PENDING' then
    raise exception '대기 상태의 문서만 처리 가능합니다.';
  end if;

  -- 현재 단계 결재자 확인
  select approver_id into v_step_approver
  from public.approval_steps
  where approval_id = p_id and step_index = v_current_step;

  if v_step_approver is null then
    raise exception '현재 단계 결재자 정보가 없습니다.';
  end if;

  if v_step_approver <> v_user then
    raise exception '현재 결재자가 아닙니다.';
  end if;

  -- 반려 처리
  if p_action = 'reject' then
    if p_comment is null or btrim(p_comment) = '' then
      raise exception '반려 사유를 입력해주세요.';
    end if;

    update public.approval_steps
      set status = 'REJECTED',
          decided_at = now(),
          comment = p_comment
      where approval_id = p_id and step_index = v_current_step;

    update public.approvals
      set status = 'REJECTED',
          decision_comment = p_comment
      where id = p_id;

    -- log_approval_update trigger 자동 로깅
    return;
  end if;

  if p_action <> 'approve' then
    raise exception 'invalid action: %', p_action;
  end if;

  -- 현재 단계 승인
  update public.approval_steps
    set status = 'APPROVED',
        decided_at = now(),
        comment = p_comment
    where approval_id = p_id and step_index = v_current_step;

  if v_current_step >= v_total_steps then
    -- 마지막 단계 → 최종 승인
    update public.approvals
      set status = 'APPROVED',
          decision_comment = p_comment
      where id = p_id;
    -- log_approval_update trigger 자동 로깅
  else
    -- 다음 단계로 진행
    v_next_step := v_current_step + 1;

    select approver_id into v_next_approver
    from public.approval_steps
    where approval_id = p_id and step_index = v_next_step;

    if v_next_approver is null then
      raise exception '다음 단계 결재자 정보가 없습니다.';
    end if;

    update public.approval_steps
      set status = 'PENDING'
      where approval_id = p_id and step_index = v_next_step;

    update public.approvals
      set current_step = v_next_step,
          approver_id  = v_next_approver
      where id = p_id;

    -- status 가 PENDING 그대로이므로 trigger 가 안 잡음 → 수동 로깅
    insert into public.approval_actions(approval_id, actor_id, action, comment)
    values (p_id, v_user, 'approve', p_comment);
  end if;
end;
$$;

grant execute on function public.advance_approval(bigint, text, text) to authenticated;

-- ============================================================================
-- 2) approvals_select 정책 확장: 본인이 단계 결재자인 경우도 조회 허용
--   (DRAFT는 step 행이 없으므로 자연스럽게 차단됨)
-- ============================================================================

drop policy if exists "approvals_select" on public.approvals;

create policy "approvals_select"
  on public.approvals
  for select
  to authenticated
  using (
    author_id = auth.uid()
    or (approver_id = auth.uid() and status <> 'DRAFT')
    or exists (
      select 1 from public.approval_steps s
      where s.approval_id = id
        and s.approver_id = auth.uid()
    )
  );

-- ============================================================================
-- 3) actions_select_visible 정책 확장: 단계 결재자도 감사로그 조회 가능
-- ============================================================================

drop policy if exists "actions_select_visible" on public.approval_actions;

create policy "actions_select_visible"
  on public.approval_actions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.approvals a
      where a.id = approval_id
        and (
          a.author_id = auth.uid()
          or (a.approver_id = auth.uid() and a.status <> 'DRAFT')
          or exists (
            select 1 from public.approval_steps s
            where s.approval_id = a.id
              and s.approver_id = auth.uid()
          )
        )
    )
  );
