"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  LeavePayload,
  ExpensePayload,
  LeaveOfAbsencePayload,
  ReinstatementPayload,
  EmploymentCertPayload,
  CareerCertPayload,
} from "@/lib/schemas";
import { diffDays } from "@/lib/format";
import type { ApprovalType } from "@/lib/approvals";
import { resolveApproverId } from "@/lib/approvers";

export type NewState = { error?: string } | null;

function readChosenApproverId(formData: FormData): string | null {
  const v = formData.get("approverId");
  if (typeof v !== "string" || !v) return null;
  return v;
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

  let second_approver_id: string | null = null;
  if (submit) {
    const { id, error: approverErr } = await resolveApproverId(
      supabase,
      user.id,
      readChosenApproverId(formData),
    );
    if (approverErr) return { error: approverErr };
    second_approver_id = id;
  }

  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("approvals")
    .insert({
      type: "leave",
      title,
      author_id: user.id,
      first_approver_id: user.id,
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
    const { id, error: approverErr } = await resolveApproverId(
      supabase,
      user.id,
      readChosenApproverId(formData),
    );
    if (approverErr) return { error: approverErr };
    second_approver_id = id;
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

/** 공통 INSERT 헬퍼 */
async function insertApproval(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  params: {
    type: ApprovalType;
    title: string;
    payload: unknown;
    submit: boolean;
    chosenApproverId: string | null;
  },
): Promise<{ id?: number; error?: string }> {
  let second_approver_id: string | null = null;
  if (params.submit) {
    const { id, error } = await resolveApproverId(
      supabase,
      userId,
      params.chosenApproverId,
    );
    if (error) return { error };
    second_approver_id = id;
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("approvals")
    .insert({
      type: params.type,
      title: params.title,
      author_id: userId,
      first_approver_id: userId,
      second_approver_id,
      step: params.submit ? 2 : 1,
      approver_id: params.submit ? second_approver_id : null,
      first_decided_at: params.submit ? now : null,
      status: params.submit ? "PENDING" : "DRAFT",
      payload: params.payload,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data!.id };
}

export async function createLeaveOfAbsenceAction(
  _prev: NewState,
  formData: FormData,
): Promise<NewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요" };

  const submit = formData.get("submit") === "1";
  const payload = {
    start: formData.get("start") as string,
    end: formData.get("end") as string,
    reason: formData.get("reason") as string,
  };
  const parsed = LeaveOfAbsencePayload.safeParse(payload);
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  const title = `휴직원 (${parsed.data.start} ~ ${parsed.data.end})`;
  const res = await insertApproval(supabase, user.id, {
    type: "leave_of_absence",
    title,
    payload: parsed.data,
    submit,
    chosenApproverId: readChosenApproverId(formData),
  });
  if (res.error) return { error: res.error };
  redirect(`/approvals/${res.id}`);
}

export async function createReinstatementAction(
  _prev: NewState,
  formData: FormData,
): Promise<NewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요" };

  const submit = formData.get("submit") === "1";
  const payload = {
    return_date: formData.get("return_date") as string,
    reason: formData.get("reason") as string,
  };
  const parsed = ReinstatementPayload.safeParse(payload);
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  const title = `복직원 (${parsed.data.return_date} 복귀)`;
  const res = await insertApproval(supabase, user.id, {
    type: "reinstatement",
    title,
    payload: parsed.data,
    submit,
    chosenApproverId: readChosenApproverId(formData),
  });
  if (res.error) return { error: res.error };
  redirect(`/approvals/${res.id}`);
}

export async function createEmploymentCertAction(
  _prev: NewState,
  formData: FormData,
): Promise<NewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요" };

  const submit = formData.get("submit") === "1";
  const payload = {
    purpose: formData.get("purpose") as string,
    destination: (formData.get("destination") as string) || "",
    copies: Number(formData.get("copies") || 1),
  };
  const parsed = EmploymentCertPayload.safeParse(payload);
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  const title = `재직증명서 신청${parsed.data.destination ? ` (${parsed.data.destination})` : ""}`;
  const res = await insertApproval(supabase, user.id, {
    type: "employment_cert",
    title,
    payload: parsed.data,
    submit,
    chosenApproverId: readChosenApproverId(formData),
  });
  if (res.error) return { error: res.error };
  redirect(`/approvals/${res.id}`);
}

export async function createCareerCertAction(
  _prev: NewState,
  formData: FormData,
): Promise<NewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요" };

  const submit = formData.get("submit") === "1";
  const payload = {
    purpose: formData.get("purpose") as string,
    destination: (formData.get("destination") as string) || "",
    period_start: (formData.get("period_start") as string) || "",
    period_end: (formData.get("period_end") as string) || "",
    copies: Number(formData.get("copies") || 1),
  };
  const parsed = CareerCertPayload.safeParse(payload);
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  const title = `경력증명서 신청${parsed.data.destination ? ` (${parsed.data.destination})` : ""}`;
  const res = await insertApproval(supabase, user.id, {
    type: "career_cert",
    title,
    payload: parsed.data,
    submit,
    chosenApproverId: readChosenApproverId(formData),
  });
  if (res.error) return { error: res.error };
  redirect(`/approvals/${res.id}`);
}
