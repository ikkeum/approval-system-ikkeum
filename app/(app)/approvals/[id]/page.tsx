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

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,name,dept,role,stamp_svg")
    .in(
      "id",
      [row.author_id, row.approver_id].filter(Boolean) as string[],
    );
  const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const author = pmap.get(row.author_id);
  const approver = row.approver_id ? pmap.get(row.approver_id) : null;

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

  // 결재자 후보 (작성자가 DRAFT에서 결재자 재지정 가능)
  let approverCandidates: { id: string; name: string; dept: string | null }[] = [];
  if (row.author_id === user!.id) {
    const { data: list } = await supabase
      .from("profiles")
      .select("id,name,dept")
      .neq("id", user!.id)
      .order("name");
    approverCandidates = list ?? [];
  }

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
        {approver && (
          <>
            {" · "}
            결재자 <strong>{approver.name}</strong>
            {approver.dept && ` (${approver.dept})`}
          </>
        )}
      </p>

      <section style={card}>
        <h2 style={h2}>상세</h2>
        {row.type === "leave" ? (
          <LeaveDetails payload={row.payload as LeaveP} />
        ) : (
          <ExpenseDetails payload={row.payload as ExpenseP} />
        )}
      </section>

      {row.decision_comment && row.status !== "PENDING" && (
        <section style={card}>
          <h2 style={h2}>결재자 의견</h2>
          <p style={{ fontSize: 14, whiteSpace: "pre-wrap", color: "#374151" }}>
            {row.decision_comment}
          </p>
        </section>
      )}

      {/* 직인 */}
      {row.status === "APPROVED" && approver?.stamp_svg && (
        <section style={{ ...card, display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{ width: 120, height: 120 }}
            dangerouslySetInnerHTML={{ __html: approver.stamp_svg }}
          />
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            <div>
              <strong style={{ color: "#1E1E1C" }}>{approver.name}</strong> 님이
              승인했습니다.
            </div>
            <div>{formatDateTime(row.decided_at)}</div>
          </div>
        </section>
      )}

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

      <DecisionPanel
        id={row.id}
        mode={mode}
        approvers={approverCandidates}
        currentApproverId={row.approver_id}
      />
    </main>
  );
}

type LeaveP = { leaveType: string; start: string; end: string; days: number; reason: string };
type ExpenseP = { amount: number; purpose: string; content: string };

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
