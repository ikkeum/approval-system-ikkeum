"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeavePayload, ExpensePayload } from "@/lib/schemas";
import { diffDays } from "@/lib/format";

export type NewState = { error?: string } | null;

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
  const approver_id = (formData.get("approver_id") as string) || "";
  const leaveType = formData.get("leaveType") as
    | "연차"
    | "오전반차"
    | "오후반차";
  const start = formData.get("start") as string;
  const end = formData.get("end") as string;
  const reason = formData.get("reason") as string;

  if (submit && !approver_id) return { error: "결재자를 선택해주세요." };

  const days =
    leaveType === "연차" ? diffDays(start, end) : 0.5;

  const payload = { leaveType, start, end, days, reason };
  const parsed = LeavePayload.safeParse(payload);
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  const title =
    leaveType === "연차"
      ? `연차 사용 (${start} ~ ${end})`
      : `${leaveType} (${start})`;

  const { data: inserted, error } = await supabase
    .from("approvals")
    .insert({
      type: "leave",
      title,
      author_id: user.id,
      approver_id: submit ? approver_id : null,
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
  const approver_id = (formData.get("approver_id") as string) || "";
  const titleRaw = formData.get("title") as string;
  const amount = Number(formData.get("amount"));
  const purpose = formData.get("purpose") as string;
  const content = formData.get("content") as string;

  if (submit && !approver_id) return { error: "결재자를 선택해주세요." };

  const payload = { amount, purpose, content };
  const parsed = ExpensePayload.safeParse(payload);
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  const { data: inserted, error } = await supabase
    .from("approvals")
    .insert({
      type: "expense",
      title: titleRaw?.trim() || `품의 (${purpose})`,
      author_id: user.id,
      approver_id: submit ? approver_id : null,
      status: submit ? "PENDING" : "DRAFT",
      payload: parsed.data,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  redirect(`/approvals/${inserted!.id}`);
}
