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

export type NewState = { error?: string } | null;

/**
 * 대표(executive) 조회.
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

/**
 * 작성자 기준 결재자(2단계) 결정.
 *   팀원 → 팀장
 *   팀장 또는 무소속 → 대표
 *   본인 = 결재자(self-loop)면 에러
 */
async function resolveApprover(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authorId: string,
): Promise<{ id: string | null; error?: string }> {
  const { data: author } = await supabase
    .from("profiles")
    .select("id, team_id")
    .eq("id", authorId)
    .maybeSingle();
  if (!author) return { id: null, error: "프로필을 찾을 수 없습니다." };

  let approverId: string | null = null;
  if (author.team_id) {
    const { data: team } = await supabase
      .from("teams")
      .select("leader_id")
      .eq("id", author.team_id)
      .maybeSingle();
    if (team?.leader_id && team.leader_id !== authorId) {
      approverId = team.leader_id;
    }
  }

  if (!approverId) {
    approverId = await lookupExecutiveId(supabase);
  }

  if (!approverId) {
    return {
      id: null,
      error: "결재자를 결정할 수 없습니다. 관리자에게 문의하세요.",
    };
  }
  if (approverId === authorId) {
    return {
      id: null,
      error: "본인이 결재 대상입니다. 관리자에게 결재 라인 설정을 요청하세요.",
    };
  }
  return { id: approverId };
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

  // 1단계(기안) = 본인. 2단계(결재) = 팀장 OR 대표 (팀 라우팅).
  let second_approver_id: string | null = null;
  if (submit) {
    const { id, error: approverErr } = await resolveApprover(supabase, user.id);
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
    const { id, error: approverErr } = await resolveApprover(supabase, user.id);
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
  },
): Promise<{ id?: number; error?: string }> {
  let second_approver_id: string | null = null;
  if (params.submit) {
    const { id, error } = await resolveApprover(supabase, userId);
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
  });
  if (res.error) return { error: res.error };
  redirect(`/approvals/${res.id}`);
}
