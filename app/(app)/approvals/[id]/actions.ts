"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { insertLeaveEvent } from "@/lib/google-calendar";
import { resolveChainApprovers } from "@/lib/approvers";
import { loadTemplateById } from "@/lib/templates";

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

export async function submitAction(
  id: number,
  pickerSelections: Record<number, string>,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요" };

  const { data: row } = await supabase
    .from("approvals")
    .select("status,author_id,template_id")
    .eq("id", id)
    .single();
  if (!row) return { error: "문서를 찾을 수 없습니다." };
  if (row.author_id !== user.id) return { error: "권한 없음" };
  if (row.status !== "DRAFT") return { error: "임시저장 상태만 제출 가능" };
  if (!row.template_id) return { error: "템플릿이 지정되지 않았습니다." };

  const template = await loadTemplateById(supabase, row.template_id);
  if (!template) return { error: "템플릿을 찾을 수 없습니다." };

  const resolution = await resolveChainApprovers(
    supabase,
    template.chain,
    user.id,
    pickerSelections,
  );
  if (!resolution.ok) return { error: resolution.error };

  const now = new Date().toISOString();
  const stepRows = resolution.steps.map((s) => ({
    approval_id: id,
    step_index: s.index,
    approver_id: s.approver_id,
    mode: s.mode,
    status: s.mode === "author" ? "APPROVED" : "WAITING",
    decided_at: s.mode === "author" ? now : null,
    comment: null as string | null,
  }));

  const firstPending = stepRows.find((r) => r.status !== "APPROVED");
  if (!firstPending) {
    return { error: "결재 라인이 모두 자동 승인 단계입니다. (관리자 문의)" };
  }
  firstPending.status = "PENDING";

  const { error: stepErr } = await supabase
    .from("approval_steps")
    .insert(stepRows);
  if (stepErr) return { error: stepErr.message };

  const { error } = await supabase
    .from("approvals")
    .update({
      status: "PENDING",
      approver_id: firstPending.approver_id,
      current_step: firstPending.step_index,
      total_steps: template.chain.length,
    })
    .eq("id", id);
  if (error) {
    // 정리: step 행 롤백 (best effort)
    await supabase.from("approval_steps").delete().eq("approval_id", id);
    return { error: error.message };
  }

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
