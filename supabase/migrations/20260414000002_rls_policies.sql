-- 20260414000002_rls_policies.sql
-- RLS 활성화 + 정책.
-- ⚠️ 이 마이그레이션은 1단계(init_schema) 직후, 데이터 삽입 전에 반드시 적용.

-- ============================================================================
-- ENABLE RLS (정책 없이 ENABLE 하면 모든 접근이 거부됨 → 아래 정책까지 함께 적용해야 함)
-- ============================================================================

alter table public.profiles         enable row level security;
alter table public.approvals        enable row level security;
alter table public.approval_actions enable row level security;

-- ============================================================================
-- profiles
-- ============================================================================

-- 인증된 사용자는 전체 조회 가능 (UI에서 이름/부서 표시용)
create policy "profiles_read_all_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

-- 본인 row만 UPDATE (이름/부서 수정 정도). role, manager_id 같은 민감 필드는 admin 전용 API로 분리 필요.
create policy "profiles_self_update"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- INSERT는 금지 (handle_new_user trigger가 SECURITY DEFINER로만 생성)
-- DELETE는 금지 (퇴사자 처리는 관리자가 별도 API로)

-- ============================================================================
-- approvals
-- ============================================================================

-- SELECT: 본인 문서 OR (본인이 결재자 AND DRAFT 아님)
--   → 내 DRAFT는 남에게 안 보이고, 결재자는 PENDING 이상부터만 봄
create policy "approvals_select"
  on public.approvals
  for select
  to authenticated
  using (
    author_id = auth.uid()
    or (approver_id = auth.uid() and status <> 'DRAFT')
  );

-- INSERT: 본인으로만 생성
create policy "approvals_insert_own"
  on public.approvals
  for insert
  to authenticated
  with check (author_id = auth.uid());

-- Author UPDATE: DRAFT 편집 + PENDING→CANCELED(철회)
--   상태 전이는 trigger가 추가 검증
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
  );

-- Approver UPDATE: PENDING 상태에서 승인/반려
--   WITH CHECK으로 approver_id 자체를 다른 사람으로 바꾸는 공격 방어
create policy "approvals_approver_decide"
  on public.approvals
  for update
  to authenticated
  using (
    approver_id = auth.uid()
    and status = 'PENDING'
  )
  with check (
    approver_id = auth.uid()
  );

-- DELETE: DRAFT만 본인이 삭제 가능 (PENDING 이상은 CANCELED로 철회)
create policy "approvals_delete_own_draft"
  on public.approvals
  for delete
  to authenticated
  using (
    author_id = auth.uid()
    and status = 'DRAFT'
  );

-- ============================================================================
-- approval_actions (감사 로그)
-- ============================================================================

-- SELECT: 연결된 approval이 내게 보이는 경우만
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
        )
    )
  );

-- INSERT: actor=self + 해당 approval의 author/approver만
create policy "actions_insert_self"
  on public.approval_actions
  for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and exists (
      select 1
      from public.approvals a
      where a.id = approval_id
        and (a.author_id = auth.uid() or a.approver_id = auth.uid())
    )
  );

-- UPDATE/DELETE: 금지 (감사 로그 immutability)
