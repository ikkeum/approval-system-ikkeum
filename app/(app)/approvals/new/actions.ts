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
import {
  loadTemplateByKey,
  type DocumentTemplate,
  type ChainStep,
} from "@/lib/templates";
import { resolveChainApprovers } from "@/lib/approvers";
import { notifyApprovalEvent } from "@/lib/notifications";

export type NewState = { error?: string } | null;

type SB = Awaited<ReturnType<typeof createClient>>;

// ============================================================================
// 공통 유틸
// ============================================================================

function readPickerSelections(
  chain: ChainStep[],
  formData: FormData,
): Record<number, string> {
  const pickerSteps = chain.filter((s) => s.mode === "picker");
  const out: Record<number, string> = {};
  for (const step of pickerSteps) {
    const indexed = formData.get(`approverId_${step.index}`);
    if (typeof indexed === "string" && indexed) {
      out[step.index] = indexed;
      continue;
    }
    // 단일 picker 폼(현재 6개 템플릿)은 `approverId` 로 보낸다.
    if (pickerSteps.length === 1) {
      const legacy = formData.get("approverId");
      if (typeof legacy === "string" && legacy) out[step.index] = legacy;
    }
  }
  return out;
}

/**
 * approvals row + approval_steps 행들을 함께 생성한다.
 * - submit=false (DRAFT): approvals 만 INSERT, step 행은 미생성
 * - submit=true  (PENDING): chain 해석 후 step 행도 함께 INSERT.
 *   author 모드 단계는 자동 APPROVED, 첫번째 비-author 단계가 PENDING.
 */
async function insertApprovalWithSteps(
  supabase: SB,
  userId: string,
  template: DocumentTemplate,
  payload: unknown,
  title: string,
  submit: boolean,
  pickerSelections: Record<number, string>,
): Promise<{ id?: number; error?: string }> {
  const totalSteps = template.chain.length;

  if (!submit) {
    const { data, error } = await supabase
      .from("approvals")
      .insert({
        type: template.key,
        template_id: template.id,
        title,
        author_id: userId,
        approver_id: null,
        current_step: 1,
        total_steps: totalSteps,
        status: "DRAFT",
        payload,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { id: data!.id };
  }

  // 제출: chain 해석
  const resolution = await resolveChainApprovers(
    supabase,
    template.chain,
    userId,
    pickerSelections,
  );
  if (!resolution.ok) return { error: resolution.error };

  const now = new Date().toISOString();
  const stepRows = resolution.steps.map((s) => ({
    step_index: s.index,
    approver_id: s.approver_id,
    mode: s.mode,
    status: s.mode === "author" ? "APPROVED" : "WAITING",
    decided_at: s.mode === "author" ? now : null,
    comment: null as string | null,
  }));

  const firstPending = stepRows.find((r) => r.status !== "APPROVED");
  if (!firstPending) {
    return {
      error: "결재 라인이 모두 자동 승인 단계입니다. (관리자 문의)",
    };
  }
  firstPending.status = "PENDING";

  const { data: inserted, error: ie } = await supabase
    .from("approvals")
    .insert({
      type: template.key,
      template_id: template.id,
      title,
      author_id: userId,
      approver_id: firstPending.approver_id,
      current_step: firstPending.step_index,
      total_steps: totalSteps,
      status: "PENDING",
      payload,
    })
    .select("id")
    .single();
  if (ie) return { error: ie.message };

  const approvalId = inserted!.id as number;
  const { error: se } = await supabase.from("approval_steps").insert(
    stepRows.map((r) => ({ ...r, approval_id: approvalId })),
  );
  if (se) {
    // 정리: step 삽입 실패 시 approval row 도 제거 (best effort)
    await supabase.from("approvals").delete().eq("id", approvalId);
    return { error: se.message };
  }

  await notifyApprovalEvent(approvalId, "submitted");
  return { id: approvalId };
}

async function getUser(supabase: SB) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function loadTemplateOrErr(
  supabase: SB,
  key: string,
): Promise<{ template?: DocumentTemplate; error?: string }> {
  const t = await loadTemplateByKey(supabase, key);
  if (!t || !t.is_active) return { error: "템플릿을 찾을 수 없습니다." };
  return { template: t };
}

// ============================================================================
// 결재 종류별 액션
// ============================================================================

export async function createLeaveAction(
  _prev: NewState,
  formData: FormData,
): Promise<NewState> {
  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) return { error: "인증 필요" };
  const { template, error: terr } = await loadTemplateOrErr(supabase, "leave");
  if (!template) return { error: terr! };

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

  const res = await insertApprovalWithSteps(
    supabase,
    user.id,
    template,
    parsed.data,
    title,
    submit,
    readPickerSelections(template.chain, formData),
  );
  if (res.error) return { error: res.error };
  redirect(`/approvals/${res.id}`);
}

export async function createExpenseAction(
  _prev: NewState,
  formData: FormData,
): Promise<NewState> {
  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) return { error: "인증 필요" };
  const { template, error: terr } = await loadTemplateOrErr(supabase, "expense");
  if (!template) return { error: terr! };

  const submit = formData.get("submit") === "1";
  const titleRaw = formData.get("title") as string;
  const amount = Number(formData.get("amount"));
  const purpose = formData.get("purpose") as string;
  const content = formData.get("content") as string;

  const payload = { amount, purpose, content };
  const parsed = ExpensePayload.safeParse(payload);
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  const title = titleRaw?.trim() || `품의 (${purpose})`;
  const res = await insertApprovalWithSteps(
    supabase,
    user.id,
    template,
    parsed.data,
    title,
    submit,
    readPickerSelections(template.chain, formData),
  );
  if (res.error) return { error: res.error };
  redirect(`/approvals/${res.id}`);
}

export async function createLeaveOfAbsenceAction(
  _prev: NewState,
  formData: FormData,
): Promise<NewState> {
  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) return { error: "인증 필요" };
  const { template, error: terr } = await loadTemplateOrErr(
    supabase,
    "leave_of_absence",
  );
  if (!template) return { error: terr! };

  const submit = formData.get("submit") === "1";
  const payload = {
    start: formData.get("start") as string,
    end: formData.get("end") as string,
    reason: formData.get("reason") as string,
  };
  const parsed = LeaveOfAbsencePayload.safeParse(payload);
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  const title = `휴직원 (${parsed.data.start} ~ ${parsed.data.end})`;
  const res = await insertApprovalWithSteps(
    supabase,
    user.id,
    template,
    parsed.data,
    title,
    submit,
    readPickerSelections(template.chain, formData),
  );
  if (res.error) return { error: res.error };
  redirect(`/approvals/${res.id}`);
}

export async function createReinstatementAction(
  _prev: NewState,
  formData: FormData,
): Promise<NewState> {
  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) return { error: "인증 필요" };
  const { template, error: terr } = await loadTemplateOrErr(
    supabase,
    "reinstatement",
  );
  if (!template) return { error: terr! };

  const submit = formData.get("submit") === "1";
  const payload = {
    return_date: formData.get("return_date") as string,
    reason: formData.get("reason") as string,
  };
  const parsed = ReinstatementPayload.safeParse(payload);
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  const title = `복직원 (${parsed.data.return_date} 복귀)`;
  const res = await insertApprovalWithSteps(
    supabase,
    user.id,
    template,
    parsed.data,
    title,
    submit,
    readPickerSelections(template.chain, formData),
  );
  if (res.error) return { error: res.error };
  redirect(`/approvals/${res.id}`);
}

export async function createEmploymentCertAction(
  _prev: NewState,
  formData: FormData,
): Promise<NewState> {
  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) return { error: "인증 필요" };
  const { template, error: terr } = await loadTemplateOrErr(
    supabase,
    "employment_cert",
  );
  if (!template) return { error: terr! };

  const submit = formData.get("submit") === "1";
  const payload = {
    purpose: formData.get("purpose") as string,
    destination: (formData.get("destination") as string) || "",
    copies: Number(formData.get("copies") || 1),
  };
  const parsed = EmploymentCertPayload.safeParse(payload);
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  const title = `재직증명서 신청${
    parsed.data.destination ? ` (${parsed.data.destination})` : ""
  }`;
  const res = await insertApprovalWithSteps(
    supabase,
    user.id,
    template,
    parsed.data,
    title,
    submit,
    readPickerSelections(template.chain, formData),
  );
  if (res.error) return { error: res.error };
  redirect(`/approvals/${res.id}`);
}

export async function createCareerCertAction(
  _prev: NewState,
  formData: FormData,
): Promise<NewState> {
  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) return { error: "인증 필요" };
  const { template, error: terr } = await loadTemplateOrErr(
    supabase,
    "career_cert",
  );
  if (!template) return { error: terr! };

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

  const title = `경력증명서 신청${
    parsed.data.destination ? ` (${parsed.data.destination})` : ""
  }`;
  const res = await insertApprovalWithSteps(
    supabase,
    user.id,
    template,
    parsed.data,
    title,
    submit,
    readPickerSelections(template.chain, formData),
  );
  if (res.error) return { error: res.error };
  redirect(`/approvals/${res.id}`);
}
