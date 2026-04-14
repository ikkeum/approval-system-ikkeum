-- 20260414000003_storage.sql
-- Storage 버킷 생성 + Storage RLS.
-- 경로 규칙: {user_id}/{approval_id}/{filename}
-- 예: 3f1a.../42/receipt.pdf

-- ============================================================================
-- 버킷 생성 (private)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('approval-attachments', 'approval-attachments', false)
on conflict (id) do nothing;

-- ============================================================================
-- Storage RLS (storage.objects 테이블에 정책 추가)
-- ============================================================================

-- 업로드: 본인 prefix(={user_id})만 허용
create policy "attachments_upload_own_prefix"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'approval-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 다운로드/조회:
--   (1) 업로더 본인
--   (2) 해당 approval_id의 결재자이고 DRAFT가 아닐 때
create policy "attachments_read_own_or_approver"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'approval-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.approvals a
        where a.id::text = (storage.foldername(name))[2]
          and a.approver_id = auth.uid()
          and a.status <> 'DRAFT'
      )
    )
  );

-- 삭제: 업로더 본인 + 해당 approval이 DRAFT일 때만
--   (PENDING 이상은 증거이므로 삭제 불가)
create policy "attachments_delete_own_draft"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'approval-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.approvals a
      where a.id::text = (storage.foldername(name))[2]
        and a.author_id = auth.uid()
        and a.status = 'DRAFT'
    )
  );
