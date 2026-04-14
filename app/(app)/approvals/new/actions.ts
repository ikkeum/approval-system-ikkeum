"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeavePayload, ExpensePayload } from "@/lib/schemas";
import { diffDays } from "@/lib/format";

export type NewState = { error?: string } | null;

/**
 * 대표(2단계 결재자) 조회. 제출 시점 스냅샷.
 * 여러 명이면 created_at 이른 한 명.
 */
async function lookupExecutiveId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_executive", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function createLeaveAction(
  _prev: NewState,
  formData: FormData,
): Promise<NewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요" };

  const submit = formData.get("submit") === "1";
  const leaveType = formData.get("leaveType") as
    | "연차"
    | "오전반차"
    | "오후반차";
  const start = formData.get("start") as string;
  const end = formData.get("end") as string;
  const reason = formData.get("reason") as string;

  const days = leaveType === "연차" ? diffDays(start, end) : 0.5;

  const payload = { leaveType, start, end, days, reason };
  const parsed = LeavePayload.safeParse(payload);
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  const title =
    leaveType === "연차"
      ? `연차 사용 (${start} ~ ${end})`
      : `${leaveType} (${start})`;

  // 담당(1단계) = 작성자 본인 (기안 인증). 대표(2단계) = is_executive 스냅샷.
  let second_approver_id: string | null = null;
  if (submit) {
    second_approver_id = await lookupExecutiveId(supabase);
    if (!second_approver_id) {
      return {
        error: "대표 결재자가 지정돼 있지 않습니다. 관리자에게 문의하세요.",
      };
    }
  }

  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("approvals")
    .insert({
      type: "leave",
      title,
      author_id: user.id,
      first_approver_id: user.id, // 본인 기안
      second_approver_id,
      step: submit ? 2 : 1,
      approver_id: submit ? second_approver_id : null,
      first_decided_at: submit ? now : null,
      status: submit ? "PENDING" : "DRAFT",
      payload: parsed.data,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  redirect(`/approvals/${inserted!.id}`);
}

export async function createExpenseAction(
  _prev: NewState,
  formData: FormData,
): Promise<NewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요" };

  const submit = formData.get("submit") === "1";
  const titleRaw = formData.get("title") as string;
  const amount = Number(formData.get("amount"));
  const purpose = formData.get("purpose") as string;
  const content = formData.get("content") as string;

  const payload = { amount, purpose, content };
  const parsed = ExpensePayload.safeParse(payload);
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  let second_approver_id: string | null = null;
  if (submit) {
    second_approver_id = await lookupExecutiveId(supabase);
    if (!second_approver_id) {
      return {
        error: "대표 결재자가 지정돼 있지 않습니다. 관리자에게 문의하세요.",
      };
    }
  }

  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("approvals")
    .insert({
      type: "expense",
      title: titleRaw?.trim() || `품의 (${purpose})`,
      author_id: user.id,
      first_approver_id: user.id, // 본인 기안
      second_approver_id,
      step: submit ? 2 : 1,
      approver_id: submit ? second_approver_id : null,
      first_decided_at: submit ? now : null,
      status: submit ? "PENDING" : "DRAFT",
      payload: parsed.data,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  redirect(`/approvals/${inserted!.id}`);
}
