import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StatusBadge, { TypeTag } from "@/components/StatusBadge";
import NewApprovalMenu from "@/components/NewApprovalMenu";
import { formatDateTime } from "@/lib/format";
import type { ApprovalRow } from "@/lib/approvals";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS가 알아서 "내가 볼 수 있는" 결재만 필터
  const { data: myPending } = await supabase
    .from("approvals")
    .select("id,type,title,status,created_at")
    .eq("author_id", user!.id)
    .in("status", ["DRAFT", "PENDING"])
    .order("created_at", { ascending: false });

  const { data: toApprove } = await supabase
    .from("approvals")
    .select("id,type,title,status,created_at,author_id")
    .eq("approver_id", user!.id)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false });

  const { data: recent } = await supabase
    .from("approvals")
    .select("id,type,title,status,created_at,decided_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  return (
    <main style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>대시보드</h1>
        <NewApprovalMenu />
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <SummaryCard
          title="결재 대기 (내가 승인자)"
          count={toApprove?.length ?? 0}
          href="/approvals"
        />
        <SummaryCard
          title="내 진행 중 문서"
          count={myPending?.length ?? 0}
          href="/mydocs"
        />
      </div>

      <section style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, padding: "16px 20px" }}>
          최근 활동
        </h2>
        {(recent ?? []).length === 0 ? (
          <div
            style={{
              padding: "24px 20px",
              textAlign: "center",
              color: "#9CA3AF",
              fontSize: 13,
            }}
          >
            아직 결재 문서가 없습니다.
          </div>
        ) : (
          ((recent as Partial<ApprovalRow>[]) ?? []).map((r) => (
            <Link
              key={r.id}
              href={`/approvals/${r.id}`}
              style={row}
            >
              <TypeTag type={r.type!} />
              <span style={{ flex: 1, fontSize: 14 }}>{r.title}</span>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                {formatDateTime(r.created_at)}
              </span>
              <StatusBadge status={r.status!} />
            </Link>
          ))
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  title,
  count,
  href,
}: {
  title: string;
  count: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        ...card,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>
        {title}
      </span>
      <span style={{ fontSize: 32, fontWeight: 800, color: "#1E1E1C" }}>
        {count}
      </span>
    </Link>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const row: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: "12px 20px",
  borderTop: "1px solid #F3F4F6",
};

