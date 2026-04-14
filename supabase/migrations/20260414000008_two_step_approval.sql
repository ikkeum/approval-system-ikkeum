-- 20260414000008_two_step_approval.sql
-- 2단계 결재: 담당(first) → 대표(second, is_executive=true)
-- 기존 단일 approver_id 는 "현재 대기 결재자" 의미로 재해석.

-- 1) 대표 플래그
alter table public.profiles
  add column if not exists is_executive boolean not null default false;

comment on column public.profiles.is_executive is
  '대표(최종 결재자) 플래그. 보통 1명만 true. 신청 시 2단계 결재자로 자동 지정.';

-- 2) approvals 컬럼 확장
alter table public.approvals
  add column if not exists first_approver_id  uuid references public.profiles(id),
  add column if not exists second_approver_id uuid references public.profiles(id),
  add column if not exists step int not null default 1 check (step in (1,2)),
  add column if not exists first_decided_at timestamptz,
  add column if not exists first_comment text;

comment on column public.approvals.first_approver_id  is '담당 결재자 (1단계). 신청 시 작성자가 선택.';
comment on column public.approvals.second_approver_id is '대표 결재자 (2단계). 신청 시점 is_executive=true 스냅샷.';
comment on column public.approvals.step is '현재 결재 단계 (1=담당, 2=대표). 종결 상태에선 마지막 값 유지.';

-- 기존 데이터 백필: first_approver_id ← approver_id
update public.approvals
set first_approver_id = approver_id
where first_approver_id is null and approver_id is not null;

-- 3) 결재 처리 RPC (승인/반려 원자 처리 + 권한 검증)
--    client 에서 supabase.rpc('advance_approval', {...}) 호출.
create or replace function public.advance_approval(
  p_id bigint,
  p_action text,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
  v_step int;
  v_approver uuid;
  v_second uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select status, step, approver_id, second_approver_id
    into v_status, v_step, v_approver, v_second
  from public.approvals
  where id = p_id
  for update;

  if not found then
    raise exception '문서를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_status <> 'PENDING' then
    raise exception '대기 상태의 문서만 처리 가능합니다.';
  end if;

  if v_approver <> v_user then
    raise exception '현재 결재자가 아닙니다.';
  end if;

  if p_action = 'reject' then
    if p_comment is null or btrim(p_comment) = '' then
      raise exception '반려 사유를 입력해주세요.';
    end if;
    update public.approvals
      set status = 'REJECTED',
          decision_comment = p_comment
      where id = p_id;
    return;  -- log_approval_update trigger 가 자동 로깅
  end if;

  if p_action <> 'approve' then
    raise exception 'invalid action: %', p_action;
  end if;

  if v_step = 1 then
    -- 1단계 승인 → 2단계로 진행 (status 유지, approver_id 교체)
    if v_second is null then
      raise exception '대표 결재자가 지정돼 있지 않습니다. 관리자에게 문의하세요.';
    end if;
    update public.approvals
      set step = 2,
          approver_id = v_second,
          first_decided_at = now(),
          first_comment = p_comment
      where id = p_id;
    -- status 변경이 없으므로 trigger 가 로그하지 않음 → 수동 기록
    insert into public.approval_actions(approval_id, actor_id, action, comment)
    values (p_id, v_user, 'approve', p_comment);
  else
    -- 2단계 승인 → 최종 확정
    update public.approvals
      set status = 'APPROVED',
          decision_comment = p_comment
      where id = p_id;
    -- trigger 자동 로깅
  end if;
end;
$$;

grant execute on function public.advance_approval(bigint, text, text) to authenticated;

-- 4) RLS 완화: 담당 승인 시 approver_id 가 변하므로 with check 가 막을 수 있음.
--    지금은 RPC(SECURITY DEFINER)가 결재 처리를 전담하므로, 기존 approver_update 정책은
--    직접 UPDATE 경로를 차단 유지해도 됨. 다만 "작성자 철회" 는 여전히 UPDATE.
--    (기존 approvals_author_update 정책 그대로 OK)
