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

  // 작성자 팀 확인 → 결재자 예측
  const { data: me } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", user!.id)
    .maybeSingle();

  let approverLabel = "대표";
  let approverName: string | null = null;

  if (me?.team_id) {
    const { data: team } = await supabase
      .from("teams")
      .select("leader_id, leader:profiles!teams_leader_id_fkey(name, dept)")
      .eq("id", me.team_id)
      .maybeSingle<{
        leader_id: string | null;
        leader: { name: string; dept: string | null } | null;
      }>();
    if (team?.leader_id && team.leader_id !== user!.id && team.leader) {
      approverLabel = "팀장";
      approverName = `${team.leader.name}${team.leader.dept ? ` · ${team.leader.dept}` : ""}`;
    }
  }

  if (!approverName) {
    const { data: exec } = await supabase
      .from("profiles")
      .select("name,dept")
      .eq("is_executive", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (exec) {
      approverName = `${exec.name}${exec.dept ? ` · ${exec.dept}` : ""}`;
    }
  }

  return (
    <main style={{ padding: "32px 40px", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
        {typeMeta.label}
      </h1>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 24 }}>
        결재 라인: <strong>본인(기안)</strong> → <strong>{approverLabel}</strong>
        {approverName ? ` (${approverName})` : ""}
        . 제출하면 {approverLabel}에게 대기 상태로 전달됩니다.
      </p>

      {type === "leave" && <LeaveForm />}
      {type === "expense" && <ExpenseForm />}
      {type === "leave_of_absence" && (
        <SimpleForm
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
