import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StatusBadge, { TypeTag } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import type { ApprovalRow, ApprovalStatus } from "@/lib/approvals";

type SP = { status?: ApprovalStatus | "ALL" };
const TABS: { key: ApprovalStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "DRAFT", label: "임시저장" },
  { key: "PENDING", label: "대기" },
  { key: "APPROVED", label: "승인" },
  { key: "REJECTED", label: "반려" },
];

export default async function MyDocsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { status = "ALL" } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let q = supabase
    .from("approvals")
    .select("id,type,title,status,created_at,submitted_at,decided_at")
    .eq("author_id", user!.id);
  if (status !== "ALL") q = q.eq("status", status);

  const { data: rows } = await q.order("created_at", { ascending: false });

  return (
    <main style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>내 문서</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/approvals/new?type=leave" style={btnOutline}>
            + 연차 신청
          </Link>
          <Link href="/approvals/new?type=expense" style={btnPrimary}>
            + 품의 작성
          </Link>
        </div>
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/mydocs?status=${t.key}`}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              background: status === t.key ? "#1E1E1C" : "transparent",
              color: status === t.key ? "#fff" : "#9CA3AF",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <section style={card}>
        <header style={tableHeader}>
          <span style={{ width: 60 }}>종류</span>
          <span style={{ flex: 1 }}>제목</span>
          <span style={{ width: 100 }}>작성일</span>
          <span style={{ width: 80 }}>상태</span>
        </header>

        {(rows ?? []).length === 0 ? (
          <div style={empty}>문서가 없습니다. 새 결재를 작성해보세요.</div>
        ) : (
          ((rows as Partial<ApprovalRow>[]) ?? []).map((r, i, arr) => (
            <Link
              key={r.id}
              href={`/approvals/${r.id}`}
              style={{
                ...tableRow,
                borderBottom:
                  i === arr.length - 1 ? "none" : "1px solid #F3F4F6",
              }}
            >
              <span style={{ width: 60 }}>
                <TypeTag type={r.type!} />
              </span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>
                {r.title}
              </span>
              <span style={{ width: 100, fontSize: 12, color: "#6B7280" }}>
                {formatDate(r.created_at)}
              </span>
              <span style={{ width: 80 }}>
                <StatusBadge status={r.status!} />
              </span>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  overflow: "hidden",
};
const tableHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 20px",
  fontSize: 11,
  fontWeight: 700,
  color: "#9CA3AF",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  background: "#F9FAFB",
};
const tableRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 20px",
};
const empty: React.CSSProperties = {
  padding: "32px 20px",
  textAlign: "center",
  color: "#9CA3AF",
  fontSize: 13,
};
const btnPrimary: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 8,
  background: "#185FA5",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  boxShadow: "0 2px 8px rgba(24,95,165,0.2)",
};
const btnOutline: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 8,
  background: "#fff",
  color: "#1E1E1C",
  fontWeight: 600,
  fontSize: 13,
  border: "1.5px solid #E5E7EB",
};
