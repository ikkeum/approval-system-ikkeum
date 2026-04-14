"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function rpcAdvance(
  id: number,
  action: "approve" | "reject",
  comment: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("advance_approval", {
    p_id: id,
    p_action: action,
    p_comment: comment ?? "",
  });
  if (error) return { error: error.message };
  revalidatePath(`/approvals/${id}`);
  return {};
}

export async function approveAction(id: number, comment: string) {
  return rpcAdvance(id, "approve", comment);
}

export async function rejectAction(id: number, comment: string) {
  if (!comment.trim()) return { error: "반려 사유를 입력해주세요." };
  return rpcAdvance(id, "reject", comment);
}

export async function submitAction(id: number) {
  // 담당(1단계) = 본인 자동. 대표(2단계) = is_executive 스냅샷.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요" };

  const { data: row } = await supabase
    .from("approvals")
    .select("status,author_id")
    .eq("id", id)
    .single();
  if (!row) return { error: "문서를 찾을 수 없습니다." };
  if (row.author_id !== user.id) return { error: "권한 없음" };
  if (row.status !== "DRAFT") return { error: "임시저장 상태만 제출 가능" };

  const { data: exec } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_executive", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!exec) {
    return {
      error: "대표 결재자가 지정돼 있지 않습니다. 관리자에게 문의하세요.",
    };
  }

  const { error } = await supabase
    .from("approvals")
    .update({
      status: "PENDING",
      first_approver_id: user.id,
      second_approver_id: exec.id,
      step: 2,
      approver_id: exec.id,
      first_decided_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/approvals/${id}`);
  redirect(`/approvals/${id}`);
}

export async function cancelAction(id: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요" };

  const { data: row } = await supabase
    .from("approvals")
    .select("status,author_id")
    .eq("id", id)
    .single();
  if (!row) return { error: "문서를 찾을 수 없습니다." };
  if (row.author_id !== user.id) return { error: "작성자만 철회 가능" };
  if (row.status !== "PENDING") return { error: "대기 상태만 철회 가능" };

  const { error } = await supabase
    .from("approvals")
    .update({ status: "CANCELED", decision_comment: "(작성자 철회)" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/approvals/${id}`);
  return {};
}

export async function deleteDraftAction(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("approvals").delete().eq("id", id);
  if (error) return { error: error.message };
  redirect("/mydocs");
}
