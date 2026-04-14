import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StatusBadge, { TypeTag } from "@/components/StatusBadge";
import { formatDate, formatDateTime, formatKRW } from "@/lib/format";
import DecisionPanel from "./DecisionPanel";
import type { ApprovalRow } from "@/lib/approvals";

const ACTION_KO: Record<string, string> = {
  submit: "제출",
  approve: "승인",
  reject: "반려",
  cancel: "철회",
  comment: "코멘트",
};

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
    .select("*")
    .eq("id", id)
    .maybeSingle<ApprovalRow>();
  if (!row) notFound();

  const involvedIds = Array.from(
    new Set(
      [
        row.author_id,
        row.approver_id,
        row.first_approver_id,
        row.second_approver_id,
      ].filter(Boolean) as string[],
    ),
  );
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,name,dept,role,stamp_svg")
    .in("id", involvedIds);
  const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const author = pmap.get(row.author_id);
  const firstApprover = row.first_approver_id
    ? pmap.get(row.first_approver_id)
    : null;
  const secondApprover = row.second_approver_id
    ? pmap.get(row.second_approver_id)
    : null;

  const { data: actions } = await supabase
    .from("approval_actions")
    .select("id,actor_id,action,comment,created_at")
    .eq("approval_id", id)
    .order("created_at", { ascending: true });

  const actorIds = Array.from(new Set((actions ?? []).map((a) => a.actor_id)));
  const { data: actors } = await supabase
    .from("profiles")
    .select("id,name")
    .in("id", actorIds.length ? actorIds : ["00000000-0000-0000-0000-000000000000"]);
  const actorMap = new Map((actors ?? []).map((a) => [a.id, a.name]));

  const isAuthor = row.author_id === user!.id;
  const isApprover = row.approver_id === user!.id;
  const mode =
    isApprover && row.status === "PENDING"
      ? ({ kind: "approver", status: "PENDING" } as const)
      : isAuthor && row.status === "DRAFT"
        ? ({ kind: "author_draft" } as const)
        : isAuthor && row.status === "PENDING"
          ? ({ kind: "author_pending" } as const)
          : ({ kind: "readonly" } as const);

  return (
    <main style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        <Link href={isAuthor ? "/mydocs" : "/approvals"} style={{ color: "#185FA5" }}>
          ← 목록으로
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
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <ApprovalStep
            label="담당 (기안)"
            step={1}
            currentStep={row.step}
            status={row.status}
            person={firstApprover}
            decidedAt={row.first_decided_at}
            comment={row.first_comment}
          />
          <ApprovalStep
            label="대표"
            step={2}
            currentStep={row.step}
            status={row.status}
            person={secondApprover}
            decidedAt={row.decided_at}
            comment={row.decision_comment}
          />
        </ol>
      </section>

      <section style={card}>
        <h2 style={h2}>상세</h2>
        {row.type === "leave" ? (
          <LeaveDetails payload={row.payload as LeaveP} />
        ) : (
          <ExpenseDetails payload={row.payload as ExpenseP} />
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
              <span style={{ flex: 1 }}>
                <strong>{actorMap.get(a.actor_id) ?? "-"}</strong>
                {a.comment && (
                  <span style={{ color: "#6B7280" }}> · {a.comment}</span>
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
type Person = {
  id: string;
  name: string;
  dept: string | null;
  role: string;
  stamp_svg: string | null;
} | null
  | undefined;

function ApprovalStep({
  label,
  step,
  currentStep,
  status,
  person,
  decidedAt,
  comment,
}: {
  label: string;
  step: 1 | 2;
  currentStep: 1 | 2;
  status: string;
  person: Person;
  decidedAt: string | null;
  comment: string | null;
}) {
  let state: "pending" | "current" | "approved" | "rejected" | "skipped";
  if (status === "APPROVED") state = "approved";
  else if (status === "REJECTED") {
    // 반려: 현재 단계가 반려됨. 1단계 반려면 2단계는 skipped.
    state =
      step === currentStep
        ? "rejected"
        : step < currentStep
          ? "approved"
          : "skipped";
  } else if (status === "CANCELED") {
    state = step < currentStep ? "approved" : "skipped";
  } else if (status === "PENDING") {
    state = step < currentStep ? "approved" : step === currentStep ? "current" : "pending";
  } else {
    state = "pending"; // DRAFT
  }

  const palette = {
    pending: { bg: "#F9FAFB", fg: "#9CA3AF", bd: "#E5E7EB", label: "대기" },
    current: { bg: "#FFF8F0", fg: "#D97706", bd: "#FBBF24", label: "진행 중" },
    approved: { bg: "#F0FDF4", fg: "#16A34A", bd: "#4ADE80", label: "승인" },
    rejected: { bg: "#FEF2F2", fg: "#DC2626", bd: "#FCA5A5", label: "반려" },
    skipped: { bg: "#F3F4F6", fg: "#9CA3AF", bd: "#E5E7EB", label: "-" },
  }[state];

  const showStamp = state === "approved" && person?.stamp_svg;

  return (
    <li
      style={{
        border: `1.5px solid ${palette.bd}`,
        background: palette.bg,
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
          {step}단계 · {label}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: palette.fg,
            background: "#fff",
            border: `1px solid ${palette.bd}`,
            padding: "2px 8px",
            borderRadius: 6,
          }}
        >
          {palette.label}
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
          {decidedAt && (
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
              {formatDateTime(decidedAt)}
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
      {comment && (state === "approved" || state === "rejected") && (
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
          }}
        >
          {comment}
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
      <dd style={{ whiteSpace: "pre-wrap" }}>{payload.reason}</dd>
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
      <dd style={{ whiteSpace: "pre-wrap" }}>{payload.content}</dd>
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
  gridTemplateColumns: "100px 1fr",
  rowGap: 10,
  fontSize: 14,
  color: "#374151",
};
