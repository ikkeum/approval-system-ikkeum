import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import StatusBadge, { TypeTag } from "@/components/StatusBadge";
import { formatDate, formatDateTime, formatKRW } from "@/lib/format";
import DecisionPanel from "./DecisionPanel";
import type {
  ApprovalRow,
  ApprovalStepRow,
  ApprovalStepStatus,
  ApprovalStepMode,
} from "@/lib/approvals";
import { autoRoutedApproverId, listApproverCandidates } from "@/lib/approvers";
import { loadTemplateById, type ChainStep } from "@/lib/templates";

const ACTION_KO: Record<string, string> = {
  submit: "제출",
  approve: "승인",
  reject: "반려",
  cancel: "철회",
  comment: "코멘트",
};

function Linkify({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#185FA5", textDecoration: "underline" }}
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/**
 * sign-generator 는 viewBox 없이 width/height 만 세팅하므로,
 * CSS로 SVG 를 축소하면 내용이 clipping 된다. viewBox 를 주입해 scalable 하게.
 */
function normalizeStampSvg(svg: string | null | undefined): string {
  if (!svg) return "";
  if (/viewBox\s*=/.test(svg)) return svg;
  const m = svg.match(/<svg([^>]*)>/);
  if (!m) return svg;
  const attrs = m[1];
  const w = attrs.match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)/)?.[1];
  const h = attrs.match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)/)?.[1];
  if (!w || !h) return svg;
  return svg.replace(/<svg([^>]*)>/, `<svg$1 viewBox="0 0 ${w} ${h}">`);
}

type StepView = {
  index: number;
  label: string;
  mode: ApprovalStepMode;
  approver_id: string | null;
  status: ApprovalStepStatus;
  decided_at: string | null;
  comment: string | null;
};

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: row } = await supabase
    .from("approvals")
    .select(
      "id,type,template_id,title,author_id,approver_id,current_step,total_steps,status,payload,attachments,created_at,submitted_at,decided_at,decision_comment,updated_at",
    )
    .eq("id", id)
    .maybeSingle<ApprovalRow>();
  if (!row) notFound();

  // 템플릿 + step 행 로드
  const [template, stepsRes] = await Promise.all([
    row.template_id ? loadTemplateById(supabase, row.template_id) : null,
    supabase
      .from("approval_steps")
      .select("approval_id,step_index,approver_id,mode,status,decided_at,comment")
      .eq("approval_id", id)
      .order("step_index", { ascending: true }),
  ]);
  const stepRows = (stepsRes.data ?? []) as ApprovalStepRow[];

  const isAuthor = row.author_id === user!.id;
  const isApprover = row.approver_id === user!.id;
  const isAuthorDraft = isAuthor && row.status === "DRAFT";

  // DRAFT: step 행이 없으니 chain 기반으로 미리보기 합성
  // 비-DRAFT: stepRows 그대로
  const chain: ChainStep[] = template?.chain ?? [];
  const draftDefaultApproverId = isAuthorDraft
    ? await autoRoutedApproverId(supabase, user!.id)
    : null;

  const stepViews: StepView[] = stepRows.length
    ? stepRows.map((s) => {
        const c = chain.find((x) => x.index === s.step_index);
        return {
          index: s.step_index,
          label: c?.label ?? `${s.step_index}단계`,
          mode: s.mode,
          approver_id: s.approver_id,
          status: s.status,
          decided_at: s.decided_at,
          comment: s.comment,
        };
      })
    : chain.map((c) => ({
        index: c.index,
        label: c.label,
        mode: c.mode,
        approver_id:
          c.mode === "author"
            ? row.author_id
            : c.mode === "fixed"
              ? c.approver_id ?? null
              : c.mode === "picker"
                ? draftDefaultApproverId
                : null,
        status: "WAITING" as ApprovalStepStatus,
        decided_at: null,
        comment: null,
      }));

  // 표시할 사람들 (작성자 + 모든 step 결재자)
  const involvedIds = Array.from(
    new Set(
      [row.author_id, row.approver_id, ...stepViews.map((s) => s.approver_id)]
        .filter(Boolean) as string[],
    ),
  );
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,name,dept,role,is_executive,stamp_svg")
    .in(
      "id",
      involvedIds.length ? involvedIds : ["00000000-0000-0000-0000-000000000000"],
    );
  const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const author = pmap.get(row.author_id);

  const { data: actions } = await supabase
    .from("approval_actions")
    .select("id,actor_id,action,comment,created_at")
    .eq("approval_id", id)
    .order("created_at", { ascending: true });

  const actorIds = Array.from(new Set((actions ?? []).map((a) => a.actor_id)));
  const { data: actors } = await supabase
    .from("profiles")
    .select("id,name")
    .in(
      "id",
      actorIds.length ? actorIds : ["00000000-0000-0000-0000-000000000000"],
    );
  const actorMap = new Map((actors ?? []).map((a) => [a.id, a.name]));

  // DecisionPanel 모드
  const draftCandidates = isAuthorDraft
    ? await listApproverCandidates(supabase, user!.id)
    : [];
  const pickerSteps = isAuthorDraft
    ? chain
        .filter((c) => c.mode === "picker")
        .map((c) => ({
          index: c.index,
          label: c.label,
          defaultApproverId: draftDefaultApproverId,
        }))
    : [];

  const mode =
    isApprover && row.status === "PENDING"
      ? ({ kind: "approver", status: "PENDING" } as const)
      : isAuthorDraft
        ? ({
            kind: "author_draft",
            candidates: draftCandidates,
            pickerSteps,
          } as const)
        : isAuthor && row.status === "PENDING"
          ? ({ kind: "author_pending" } as const)
          : ({ kind: "readonly" } as const);

  // 타임라인 그리드: 2개면 1x2, 그 이상이면 minmax 컬럼
  const stepsGridCols =
    stepViews.length <= 2
      ? `repeat(${Math.max(stepViews.length, 1)}, minmax(0, 1fr))`
      : `repeat(${stepViews.length}, minmax(0, 1fr))`;

  return (
    <main style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        <Link
          href={isAuthor ? "/mydocs" : "/approvals"}
          style={{
            color: "#185FA5",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <ArrowLeft size={14} />
          목록으로
        </Link>
      </div>

      <header
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <TypeTag type={row.type} />
        <h1 style={{ fontSize: 22, fontWeight: 800, flex: 1 }}>{row.title}</h1>
        <StatusBadge status={row.status} />
      </header>

      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 24 }}>
        작성자 <strong>{author?.name ?? "-"}</strong>
        {author?.dept && ` · ${author.dept}`} · 신청일 {formatDate(row.created_at)}
      </p>

      {/* 결재 라인 */}
      <section style={card}>
        <h2 style={h2}>결재 라인</h2>
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            display: "grid",
            gridTemplateColumns: stepsGridCols,
            gap: 12,
          }}
        >
          {stepViews.map((sv) => (
            <ApprovalStep
              key={sv.index}
              view={sv}
              person={sv.approver_id ? pmap.get(sv.approver_id) : null}
              isDraft={row.status === "DRAFT"}
            />
          ))}
        </ol>
      </section>

      <section style={card}>
        <h2 style={h2}>상세</h2>
        {row.type === "leave" && (
          <LeaveDetails payload={row.payload as LeaveP} />
        )}
        {row.type === "expense" && (
          <ExpenseDetails payload={row.payload as ExpenseP} />
        )}
        {row.type === "leave_of_absence" && (
          <LeaveOfAbsenceDetails payload={row.payload as LeaveOfAbsenceP} />
        )}
        {row.type === "reinstatement" && (
          <ReinstatementDetails payload={row.payload as ReinstatementP} />
        )}
        {row.type === "employment_cert" && (
          <EmploymentCertDetails payload={row.payload as EmploymentCertP} />
        )}
        {row.type === "career_cert" && (
          <CareerCertDetails payload={row.payload as CareerCertP} />
        )}
        {row.type === "attendance_correction" && (
          <AttendanceCorrectionDetails
            payload={row.payload as AttendanceCorrectionP}
          />
        )}
      </section>

      <section style={card}>
        <h2 style={h2}>히스토리</h2>
        <ol style={{ listStyle: "none", padding: 0 }}>
          {(actions ?? []).map((a) => (
            <li
              key={a.id}
              style={{
                display: "flex",
                gap: 10,
                padding: "8px 0",
                borderBottom: "1px solid #F3F4F6",
                fontSize: 13,
              }}
            >
              <span style={{ width: 60, color: "#9CA3AF" }}>
                {ACTION_KO[a.action] ?? a.action}
              </span>
              <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                <strong>{actorMap.get(a.actor_id) ?? "-"}</strong>
                {a.comment && (
                  <span style={{ color: "#6B7280" }}>
                    {" · "}
                    <Linkify text={a.comment} />
                  </span>
                )}
              </span>
              <span style={{ color: "#9CA3AF" }}>
                {formatDateTime(a.created_at)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <DecisionPanel id={row.id} mode={mode} />
    </main>
  );
}

type LeaveP = { leaveType: string; start: string; end: string; days: number; reason: string };
type ExpenseP = { amount: number; purpose: string; content: string };
type LeaveOfAbsenceP = { start: string; end: string; reason: string };
type ReinstatementP = { return_date: string; reason: string };
type EmploymentCertP = { purpose: string; destination?: string; copies: number };
type CareerCertP = {
  purpose: string;
  destination?: string;
  period_start?: string;
  period_end?: string;
  copies: number;
};
type AttendanceCorrectionP = {
  correction_date: string;
  check_in_time?: string;
  check_out_time?: string;
  reason: string;
};
type Person =
  | {
      id: string;
      name: string;
      dept: string | null;
      role: string;
      is_executive?: boolean;
      stamp_svg: string | null;
    }
  | null
  | undefined;

function ApprovalStep({
  view,
  person,
  isDraft,
}: {
  view: StepView;
  person: Person;
  isDraft: boolean;
}) {
  type DisplayState =
    | "draft"
    | "pending"
    | "current"
    | "approved"
    | "rejected"
    | "skipped";

  let state: DisplayState;
  if (isDraft) state = "draft";
  else if (view.status === "APPROVED") state = "approved";
  else if (view.status === "REJECTED") state = "rejected";
  else if (view.status === "SKIPPED") state = "skipped";
  else if (view.status === "PENDING") state = "current";
  else state = "pending"; // WAITING

  const palette: Record<
    DisplayState,
    { bg: string; fg: string; bd: string; label: string }
  > = {
    draft: { bg: "#EFF6FF", fg: "#2563EB", bd: "#BFDBFE", label: "예정" },
    pending: { bg: "#F9FAFB", fg: "#9CA3AF", bd: "#E5E7EB", label: "대기" },
    current: { bg: "#FFF8F0", fg: "#D97706", bd: "#FBBF24", label: "진행 중" },
    approved: { bg: "#F0FDF4", fg: "#16A34A", bd: "#4ADE80", label: "승인" },
    rejected: { bg: "#FEF2F2", fg: "#DC2626", bd: "#FCA5A5", label: "반려" },
    skipped: { bg: "#F3F4F6", fg: "#9CA3AF", bd: "#E5E7EB", label: "-" },
  };
  const p = palette[state];

  const showStamp = state === "approved" && person?.stamp_svg;

  return (
    <li
      style={{
        border: `1.5px solid ${p.bd}`,
        background: p.bg,
        borderRadius: 10,
        padding: "14px 16px",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>
          {view.index}단계 · {view.label}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: p.fg,
            background: "#fff",
            border: `1px solid ${p.bd}`,
            padding: "2px 8px",
            borderRadius: 6,
          }}
        >
          {p.label}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {person?.name ?? "-"}
          </div>
          {person?.dept && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>{person.dept}</div>
          )}
          {view.decided_at && (
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
              {formatDateTime(view.decided_at)}
            </div>
          )}
        </div>
        {showStamp && (
          <div
            className="stamp-frame"
            style={{
              width: 80,
              height: 80,
              flexShrink: 0,
            }}
            aria-label={`${person.name} 직인`}
            dangerouslySetInnerHTML={{
              __html: normalizeStampSvg(person.stamp_svg),
            }}
          />
        )}
      </div>
      {view.comment && (state === "approved" || state === "rejected") && (
        <div
          style={{
            marginTop: 8,
            padding: "6px 8px",
            fontSize: 12,
            color: "#374151",
            background: "#fff",
            borderRadius: 6,
            border: "1px solid rgba(0,0,0,0.04)",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          <Linkify text={view.comment} />
        </div>
      )}
    </li>
  );
}

function LeaveDetails({ payload }: { payload: LeaveP }) {
  return (
    <dl style={dl}>
      <dt>유형</dt>
      <dd>{payload.leaveType}</dd>
      <dt>기간</dt>
      <dd>
        {payload.start} ~ {payload.end} ({payload.days}일)
      </dd>
      <dt>사유</dt>
      <dd style={ddText}>
        <Linkify text={payload.reason} />
      </dd>
    </dl>
  );
}

function ExpenseDetails({ payload }: { payload: ExpenseP }) {
  return (
    <dl style={dl}>
      <dt>금액</dt>
      <dd style={{ fontWeight: 700 }}>{formatKRW(payload.amount)}</dd>
      <dt>용도</dt>
      <dd>{payload.purpose}</dd>
      <dt>내용</dt>
      <dd style={ddText}>
        <Linkify text={payload.content} />
      </dd>
    </dl>
  );
}

function LeaveOfAbsenceDetails({ payload }: { payload: LeaveOfAbsenceP }) {
  return (
    <dl style={dl}>
      <dt>휴직 기간</dt>
      <dd>
        {payload.start} ~ {payload.end}
      </dd>
      <dt>사유</dt>
      <dd style={ddText}>
        <Linkify text={payload.reason} />
      </dd>
    </dl>
  );
}

function ReinstatementDetails({ payload }: { payload: ReinstatementP }) {
  return (
    <dl style={dl}>
      <dt>복귀 예정일</dt>
      <dd style={{ fontWeight: 700 }}>{payload.return_date}</dd>
      <dt>사유</dt>
      <dd style={ddText}>
        <Linkify text={payload.reason} />
      </dd>
    </dl>
  );
}

function EmploymentCertDetails({ payload }: { payload: EmploymentCertP }) {
  return (
    <dl style={dl}>
      <dt>용도</dt>
      <dd>{payload.purpose}</dd>
      <dt>제출처</dt>
      <dd>{payload.destination || "-"}</dd>
      <dt>발급 부수</dt>
      <dd>{payload.copies}부</dd>
    </dl>
  );
}

function CareerCertDetails({ payload }: { payload: CareerCertP }) {
  return (
    <dl style={dl}>
      <dt>용도</dt>
      <dd>{payload.purpose}</dd>
      <dt>제출처</dt>
      <dd>{payload.destination || "-"}</dd>
      <dt>증명 기간</dt>
      <dd>
        {payload.period_start && payload.period_end
          ? `${payload.period_start} ~ ${payload.period_end}`
          : "재직 전 기간"}
      </dd>
      <dt>발급 부수</dt>
      <dd>{payload.copies}부</dd>
    </dl>
  );
}

function AttendanceCorrectionDetails({
  payload,
}: {
  payload: AttendanceCorrectionP;
}) {
  return (
    <dl style={dl}>
      <dt>정정 대상일</dt>
      <dd>{payload.correction_date}</dd>
      <dt>정정 후 출근</dt>
      <dd>{payload.check_in_time || "-"}</dd>
      <dt>정정 후 퇴근</dt>
      <dd>{payload.check_out_time || "-"}</dd>
      <dt>사유</dt>
      <dd style={{ whiteSpace: "pre-wrap" }}>
        <Linkify text={payload.reason} />
      </dd>
    </dl>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  padding: 24,
  marginBottom: 16,
};
const h2: React.CSSProperties = { fontSize: 14, fontWeight: 700, marginBottom: 12 };
const dl: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "100px minmax(0, 1fr)",
  rowGap: 10,
  fontSize: 14,
  color: "#374151",
};
const ddText: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  minWidth: 0,
};
