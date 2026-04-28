import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LeaveForm from "./LeaveForm";
import ExpenseForm from "./ExpenseForm";
import SimpleForm from "./SimpleForm";
import {
  createLeaveOfAbsenceAction,
  createReinstatementAction,
  createEmploymentCertAction,
  createCareerCertAction,
} from "./actions";
import { APPROVAL_TYPES, type ApprovalType } from "@/lib/approvals";
import {
  autoRoutedApproverId,
  listApproverCandidates,
} from "@/lib/approvers";

const VALID_TYPES = APPROVAL_TYPES.map((t) => t.key);

export default async function NewApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: rawType = "leave" } = await searchParams;
  if (!VALID_TYPES.includes(rawType as ApprovalType)) {
    redirect("/approvals/new?type=leave");
  }
  const type = rawType as ApprovalType;
  const typeMeta = APPROVAL_TYPES.find((t) => t.key === type)!;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [candidates, defaultApproverId] = await Promise.all([
    listApproverCandidates(supabase, user!.id),
    autoRoutedApproverId(supabase, user!.id),
  ]);

  return (
    <main style={{ padding: "32px 40px", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
        {typeMeta.label}
      </h1>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 24 }}>
        본인(기안) → 선택한 결재자 순으로 진행됩니다. 제출하면 결재자에게 대기 상태로 전달됩니다.
      </p>

      {type === "leave" && (
        <LeaveForm
          candidates={candidates}
          defaultApproverId={defaultApproverId}
        />
      )}
      {type === "expense" && (
        <ExpenseForm
          candidates={candidates}
          defaultApproverId={defaultApproverId}
        />
      )}
      {type === "leave_of_absence" && (
        <SimpleForm
          candidates={candidates}
          defaultApproverId={defaultApproverId}
          action={createLeaveOfAbsenceAction}
          fields={[
            {
              kind: "daterange",
              startName: "start",
              endName: "end",
              label: "휴직 기간",
            },
            {
              kind: "textarea",
              name: "reason",
              label: "사유",
              required: true,
              maxLength: 2000,
              rows: 5,
            },
          ]}
        />
      )}
      {type === "reinstatement" && (
        <SimpleForm
          candidates={candidates}
          defaultApproverId={defaultApproverId}
          action={createReinstatementAction}
          fields={[
            {
              kind: "date",
              name: "return_date",
              label: "복귀 예정일",
              required: true,
            },
            {
              kind: "textarea",
              name: "reason",
              label: "복직 사유 / 근황",
              required: true,
              maxLength: 1000,
              rows: 4,
            },
          ]}
        />
      )}
      {type === "employment_cert" && (
        <SimpleForm
          candidates={candidates}
          defaultApproverId={defaultApproverId}
          action={createEmploymentCertAction}
          fields={[
            {
              kind: "text",
              name: "purpose",
              label: "용도 (사유)",
              required: true,
              maxLength: 200,
              placeholder: "예: 은행 대출, 이사 신청 등",
            },
            {
              kind: "text",
              name: "destination",
              label: "제출처 (선택)",
              maxLength: 200,
              placeholder: "예: 국민은행",
            },
            {
              kind: "number",
              name: "copies",
              label: "발급 부수",
              required: true,
              min: 1,
              max: 10,
              defaultValue: 1,
            },
          ]}
        />
      )}
      {type === "career_cert" && (
        <SimpleForm
          candidates={candidates}
          defaultApproverId={defaultApproverId}
          action={createCareerCertAction}
          fields={[
            {
              kind: "text",
              name: "purpose",
              label: "용도 (사유)",
              required: true,
              maxLength: 200,
            },
            {
              kind: "text",
              name: "destination",
              label: "제출처 (선택)",
              maxLength: 200,
            },
            {
              kind: "daterange",
              startName: "period_start",
              endName: "period_end",
              label: "증명 대상 기간 (선택)",
            },
            {
              kind: "number",
              name: "copies",
              label: "발급 부수",
              required: true,
              min: 1,
              max: 10,
              defaultValue: 1,
            },
          ]}
        />
      )}
    </main>
  );
}
