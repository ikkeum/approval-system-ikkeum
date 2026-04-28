"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { insertLeaveEvent } from "@/lib/google-calendar";
import { resolveApproverId } from "@/lib/approvers";

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

async function maybeRegisterLeaveOnCalendar(id: number) {
  try {
    const supabase = await createClient();
    const { data: row } = await supabase
      .from("approvals")
      .select("status,type,payload,author_id")
      .eq("id", id)
      .maybeSingle();
    if (!row || row.status !== "APPROVED" || row.type !== "leave") return;

    const { data: author } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", row.author_id)
      .maybeSingle();
    if (!author?.name) return;

    const payload = row.payload as {
      leaveType?: string;
      start?: string;
      end?: string;
    };
    if (!payload.start || !payload.end) return;
    if (
      payload.leaveType !== "연차" &&
      payload.leaveType !== "오전반차" &&
      payload.leaveType !== "오후반차"
    ) {
      return;
    }

    await insertLeaveEvent({
      name: author.name,
      leaveType: payload.leaveType,
      start: payload.start,
      end: payload.end,
    });
  } catch (e) {
    console.error("[calendar] failed to register leave event", e);
  }
}

export async function approveAction(id: number, comment: string) {
  const result = await rpcAdvance(id, "approve", comment);
  if (result.error) return result;
  await maybeRegisterLeaveOnCalendar(id);
  return result;
}

export async function rejectAction(id: number, comment: string) {
  if (!comment.trim()) return { error: "반려 사유를 입력해주세요." };
  return rpcAdvance(id, "reject", comment);
}

export async function submitAction(id: number, chosenApproverId: string | null) {
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

  const { id: approverId, error: approverErr } = await resolveApproverId(
    supabase,
    user.id,
    chosenApproverId,
  );
  if (approverErr) return { error: approverErr };

  const { error } = await supabase
    .from("approvals")
    .update({
      status: "PENDING",
      first_approver_id: user.id,
      second_approver_id: approverId,
      step: 2,
      approver_id: approverId,
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
