-- 20260414000005_action_log.sql
-- approvals 상태 변경/생성 시 approval_actions 자동 기록.
-- 트랜잭션 안에서 UPDATE + 액션 INSERT가 원자적으로 이뤄지므로 race/불일치 방지.

-- INSERT 시: PENDING으로 바로 생성되면 submit 기록 (DRAFT 생성은 로그 안 함)
create or replace function public.log_approval_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'PENDING' then
    insert into public.approval_actions (approval_id, actor_id, action, comment)
    values (new.id, new.author_id, 'submit', null);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_approval_create on public.approvals;
create trigger trg_log_approval_create
  after insert on public.approvals
  for each row execute function public.log_approval_create();

-- UPDATE 시: 상태 전이에 맞춰 액션 기록. 행위자는 현재 세션의 auth.uid().
create or replace function public.log_approval_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_actor uuid := auth.uid();
begin
  if old.status = new.status then
    return new;
  end if;

  if old.status = 'DRAFT' and new.status = 'PENDING' then
    v_action := 'submit';
  elsif new.status = 'APPROVED' then
    v_action := 'approve';
  elsif new.status = 'REJECTED' then
    v_action := 'reject';
  elsif new.status = 'CANCELED' then
    v_action := 'cancel';
  else
    return new;
  end if;

  -- actor_id가 null 인 경우(서비스 컨텍스트) 안전하게 author로 대체
  if v_actor is null then v_actor := new.author_id; end if;

  insert into public.approval_actions (approval_id, actor_id, action, comment)
  values (new.id, v_actor, v_action, new.decision_comment);

  return new;
end;
$$;

drop trigger if exists trg_log_approval_update on public.approvals;
create trigger trg_log_approval_update
  after update of status on public.approvals
  for each row execute function public.log_approval_update();
