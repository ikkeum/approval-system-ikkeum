"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function run(
  id: number,
  patch: Record<string, unknown>,
  guard: (
    row: { status: string; author_id: string; approver_id: string | null },
    uid: string,
  ) => string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요" };

  const { data: row, error: selErr } = await supabase
    .from("approvals")
    .select("status,author_id,approver_id")
    .eq("id", id)
    .single();
  if (selErr || !row) return { error: "문서를 찾을 수 없습니다." };

  const violated = guard(row, user.id);
  if (violated) return { error: violated };

  const { error } = await supabase.from("approvals").update(patch).eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function submitAction(id: number, approver_id: string) {
  const res = await run(
    id,
    { status: "PENDING", approver_id },
    (r, uid) =>
      r.author_id !== uid
        ? "권한 없음"
        : r.status !== "DRAFT"
          ? "임시저장 상태에서만 제출 가능"
          : null,
  );
  if (!res.error) {
    revalidatePath(`/approvals/${id}`);
    redirect(`/approvals/${id}`);
  }
  return res;
}

export async function approveAction(id: number, comment: string) {
  const res = await run(
    id,
    { status: "APPROVED", decision_comment: comment || null },
    (r, uid) =>
      r.approver_id !== uid
        ? "결재자만 승인 가능"
        : r.status !== "PENDING"
          ? "대기 상태만 승인 가능"
          : null,
  );
  if (!res.error) revalidatePath(`/approvals/${id}`);
  return res;
}

export async function rejectAction(id: number, comment: string) {
  if (!comment.trim()) return { error: "반려 사유를 입력해주세요." };
  const res = await run(
    id,
    { status: "REJECTED", decision_comment: comment },
    (r, uid) =>
      r.approver_id !== uid
        ? "결재자만 반려 가능"
        : r.status !== "PENDING"
          ? "대기 상태만 반려 가능"
          : null,
  );
  if (!res.error) revalidatePath(`/approvals/${id}`);
  return res;
}

export async function cancelAction(id: number) {
  const res = await run(
    id,
    { status: "CANCELED", decision_comment: "(작성자 철회)" },
    (r, uid) =>
      r.author_id !== uid
        ? "작성자만 철회 가능"
        : r.status !== "PENDING"
          ? "대기 상태만 철회 가능"
          : null,
  );
  if (!res.error) revalidatePath(`/approvals/${id}`);
  return res;
}

export async function deleteDraftAction(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("approvals").delete().eq("id", id);
  if (error) return { error: error.message };
  redirect("/mydocs");
}
