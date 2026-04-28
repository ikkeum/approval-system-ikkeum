-- 20260428000001_document_templates.sql
-- Phase 1: 동적 문서 템플릿 + N단계 결재 라인 도입.
-- 이 마이그레이션은 스키마/시드/백필만 추가한다. 기존 컬럼(first_approver_id,
-- second_approver_id, step, first_decided_at, first_comment)과 advance_approval RPC는
-- Phase 2에서 코드 전환을 마친 후 별도 마이그레이션으로 제거한다.

-- ============================================================================
-- 1) document_templates: 어드민이 관리하는 결재 문서 템플릿
-- ============================================================================

create table public.document_templates (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,         -- slug (기존 approvals.type과 호환: 'leave','expense',...)
  name           text not null,                -- '연차 신청'
  short_name     text not null,                -- '연차' (배지/리스트용)
  sort_order     int  not null default 0,
  is_active      boolean not null default true,
  schema         jsonb not null,               -- Field[] (date|text|textarea|number|daterange|select|row)
  chain          jsonb not null,               -- ApprovalStep[] (mode: author|fixed|team_leader|executive|picker)
  title_template text,                         -- '{{start}} ~ {{end}}' 치환. NULL이면 코드에서 처리
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table  public.document_templates is '결재 문서 템플릿. 어드민이 CRUD.';
comment on column public.document_templates.schema is 'Field[] 배열. DynamicForm이 읽어 폼을 렌더.';
comment on column public.document_templates.chain  is 'ApprovalStep[] 배열. 최대 4단계.';

create index idx_document_templates_active on public.document_templates(is_active, sort_order);

create trigger set_updated_at_document_templates
  before update on public.document_templates
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2) approval_steps: 결재 인스턴스별 N단계 행
-- ============================================================================

create table public.approval_steps (
  approval_id bigint not null references public.approvals(id) on delete cascade,
  step_index  int    not null check (step_index between 1 and 4),
  approver_id uuid   not null references public.profiles(id),
  mode        text   not null check (mode in ('author','fixed','team_leader','executive','picker')),
  status      text   not null default 'WAITING'
                check (status in ('WAITING','PENDING','APPROVED','REJECTED','SKIPPED')),
  decided_at  timestamptz,
  comment     text,
  primary key (approval_id, step_index)
);

comment on column public.approval_steps.mode   is 'author=기안자 자동, fixed=특정 사용자, team_leader/executive=규칙, picker=기안 시 선택';
comment on column public.approval_steps.status is 'WAITING=아직 차례 아님, PENDING=현재 차례, APPROVED/REJECTED=결정 완료, SKIPPED=건너뜀';

create index idx_approval_steps_approver_status on public.approval_steps(approver_id, status);

-- ============================================================================
-- 3) approvals: 새 컬럼 추가 (기존 컬럼은 Phase 2에서 제거)
-- ============================================================================

alter table public.approvals
  add column if not exists template_id  uuid references public.document_templates(id),
  add column if not exists current_step int  not null default 1,
  add column if not exists total_steps  int  not null default 2;

comment on column public.approvals.template_id  is '문서 템플릿 참조. Phase 2 이후 type 컬럼 대체 예정.';
comment on column public.approvals.current_step is '현재 진행 중인 step_index. 종결 후엔 마지막 값 유지.';
comment on column public.approvals.total_steps  is '체인 총 단계 수 (1~4).';

-- ============================================================================
-- 4) RLS: document_templates
-- ============================================================================

alter table public.document_templates enable row level security;

-- 모든 인증 사용자는 활성 템플릿 조회 (신규 작성 메뉴/폼 렌더링용)
create policy "templates_read_all_authenticated"
  on public.document_templates
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE 정책 없음 → admin 작업은 service_role(createAdminClient)로만 처리

-- ============================================================================
-- 5) RLS: approval_steps
-- ============================================================================

alter table public.approval_steps enable row level security;

-- 본인이 보이는 approval에 연결된 step + 본인이 단계 결재자인 경우
create policy "approval_steps_select"
  on public.approval_steps
  for select
  to authenticated
  using (
    approver_id = auth.uid()
    or exists (
      select 1 from public.approvals a
      where a.id = approval_id
        and (
          a.author_id = auth.uid()
          or (a.approver_id = auth.uid() and a.status <> 'DRAFT')
        )
    )
  );

-- INSERT/UPDATE/DELETE는 RPC(advance_approval) 또는 author update flow에서만 발생.
-- author insert/update는 자기 approval 행에 연결된 step만 허용.
create policy "approval_steps_author_write"
  on public.approval_steps
  for all
  to authenticated
  using (
    exists (
      select 1 from public.approvals a
      where a.id = approval_id
        and a.author_id = auth.uid()
        and a.status in ('DRAFT','PENDING')
    )
  )
  with check (
    exists (
      select 1 from public.approvals a
      where a.id = approval_id
        and a.author_id = auth.uid()
    )
  );

-- ============================================================================
-- 6) Seed: 기존 6개 type을 document_templates로 시드
-- ============================================================================

insert into public.document_templates (key, name, short_name, sort_order, schema, chain, title_template)
values
  ('leave', '연차 신청', '연차', 10,
   $$[
     {"kind":"select","name":"leaveType","label":"유형","required":true,"options":["연차","오전반차","오후반차"]},
     {"kind":"row","children":[
       {"kind":"date","name":"start","label":"시작일","required":true},
       {"kind":"date","name":"end","label":"종료일","required":true}
     ]},
     {"kind":"textarea","name":"reason","label":"사유","required":true,"rows":3,"maxLength":500}
   ]$$::jsonb,
   $$[
     {"index":1,"label":"기안","mode":"author"},
     {"index":2,"label":"결재","mode":"picker"}
   ]$$::jsonb,
   null
  ),
  ('expense', '품의서 작성', '품의', 20,
   $$[
     {"kind":"text","name":"title","label":"제목","required":true,"maxLength":80,"placeholder":"예: AWS 서버 증설 비용"},
     {"kind":"row","children":[
       {"kind":"number","name":"amount","label":"금액 (원)","required":true,"min":0},
       {"kind":"select","name":"purpose","label":"용도","required":true,"options":["장비구매","외주비","교육비","출장비","복리후생","인프라/서버","기타"]}
     ]},
     {"kind":"textarea","name":"content","label":"상세 내용","required":true,"rows":5,"maxLength":2000}
   ]$$::jsonb,
   $$[
     {"index":1,"label":"기안","mode":"author"},
     {"index":2,"label":"결재","mode":"picker"}
   ]$$::jsonb,
   null
  ),
  ('leave_of_absence', '휴직원 신청', '휴직', 30,
   $$[
     {"kind":"daterange","startName":"start","endName":"end","label":"휴직 기간","required":true},
     {"kind":"textarea","name":"reason","label":"사유","required":true,"rows":5,"maxLength":2000}
   ]$$::jsonb,
   $$[
     {"index":1,"label":"기안","mode":"author"},
     {"index":2,"label":"결재","mode":"picker"}
   ]$$::jsonb,
   '휴직원 ({{start}} ~ {{end}})'
  ),
  ('reinstatement', '복직원 신청', '복직', 40,
   $$[
     {"kind":"date","name":"return_date","label":"복귀 예정일","required":true},
     {"kind":"textarea","name":"reason","label":"복직 사유 / 근황","required":true,"rows":4,"maxLength":1000}
   ]$$::jsonb,
   $$[
     {"index":1,"label":"기안","mode":"author"},
     {"index":2,"label":"결재","mode":"picker"}
   ]$$::jsonb,
   '복직원 ({{return_date}} 복귀)'
  ),
  ('employment_cert', '재직증명서 신청', '재직증명', 50,
   $$[
     {"kind":"text","name":"purpose","label":"용도 (사유)","required":true,"maxLength":200,"placeholder":"예: 은행 대출, 이사 신청 등"},
     {"kind":"text","name":"destination","label":"제출처 (선택)","maxLength":200,"placeholder":"예: 국민은행"},
     {"kind":"number","name":"copies","label":"발급 부수","required":true,"min":1,"max":10,"defaultValue":1}
   ]$$::jsonb,
   $$[
     {"index":1,"label":"기안","mode":"author"},
     {"index":2,"label":"결재","mode":"picker"}
   ]$$::jsonb,
   '재직증명서 신청'
  ),
  ('career_cert', '경력증명서 신청', '경력증명', 60,
   $$[
     {"kind":"text","name":"purpose","label":"용도 (사유)","required":true,"maxLength":200},
     {"kind":"text","name":"destination","label":"제출처 (선택)","maxLength":200},
     {"kind":"daterange","startName":"period_start","endName":"period_end","label":"증명 대상 기간 (선택)"},
     {"kind":"number","name":"copies","label":"발급 부수","required":true,"min":1,"max":10,"defaultValue":1}
   ]$$::jsonb,
   $$[
     {"index":1,"label":"기안","mode":"author"},
     {"index":2,"label":"결재","mode":"picker"}
   ]$$::jsonb,
   '경력증명서 신청'
  );

-- ============================================================================
-- 7) Backfill: 기존 approvals 행에 template_id, current_step, total_steps 채움
-- ============================================================================

update public.approvals a
set template_id  = t.id,
    current_step = a.step,
    total_steps  = 2
from public.document_templates t
where a.template_id is null and a.type = t.key;

-- ============================================================================
-- 8) Backfill: 기존 approvals를 approval_steps로 분해
--   - 모든 행: step 1 (기안자)
--   - DRAFT 외(submit 이후): step 2 (결재자)
-- ============================================================================

-- step 1: 기안. 제출(step>=2 또는 종결) 시점에 APPROVED, 그 외 PENDING.
-- DRAFT는 step 1만 만들고 status=PENDING(자기 차례).
insert into public.approval_steps (approval_id, step_index, approver_id, mode, status, decided_at, comment)
select
  id,
  1,
  coalesce(first_approver_id, author_id),
  'author',
  case
    when step >= 2 or status in ('APPROVED','REJECTED','CANCELED') then 'APPROVED'
    else 'PENDING'
  end,
  case
    when step >= 2 or status in ('APPROVED','REJECTED','CANCELED')
      then coalesce(first_decided_at, submitted_at)
    else null
  end,
  first_comment
from public.approvals;

-- step 2: 실제 결재자. second_approver_id가 있는 경우(=DRAFT 아님)에만.
insert into public.approval_steps (approval_id, step_index, approver_id, mode, status, decided_at, comment)
select
  id,
  2,
  second_approver_id,
  'picker',
  case
    when status = 'APPROVED' then 'APPROVED'
    when status = 'REJECTED' and step = 2 then 'REJECTED'
    when status = 'PENDING'  and step = 2 then 'PENDING'
    when status = 'CANCELED' then 'SKIPPED'
    else 'WAITING'
  end,
  case
    when status = 'APPROVED' then decided_at
    when status = 'REJECTED' and step = 2 then decided_at
    else null
  end,
  case
    when status = 'APPROVED' then decision_comment
    when status = 'REJECTED' and step = 2 then decision_comment
    else null
  end
from public.approvals
where second_approver_id is not null;
