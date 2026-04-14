import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StatusBadge, { TypeTag } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import type { ApprovalRow, ApprovalStatus } from "@/lib/approvals";

type SP = { tab?: "pending" | "done" | "all" };

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { tab = "pending" } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let q = supabase
    .from("approvals")
    .select("id,type,title,status,created_at,author_id,payload")
    .eq("approver_id", user!.id);

  if (tab === "pending") q = q.eq("status", "PENDING");
  else if (tab === "done")
    q = q.in("status", ["APPROVED", "REJECTED", "CANCELED"]);

  const { data: rows } = await q.order("created_at", { ascending: false });

  // 작성자 이름 해결
  const authorIds = Array.from(new Set((rows ?? []).map((r) => r.author_id)));
  const { data: authors } = await supabase
    .from("profiles")
    .select("id,name,dept")
    .in("id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]);
  const authorMap = new Map(
    (authors ?? []).map((a) => [a.id, { name: a.name, dept: a.dept }]),
  );

  return (
    <main style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
        결재함
      </h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <TabLink href="/approvals?tab=pending" active={tab === "pending"}>
          대기
        </TabLink>
        <TabLink href="/approvals?tab=done" active={tab === "done"}>
          처리완료
        </TabLink>
        <TabLink href="/approvals?tab=all" active={tab === "all"}>
          전체
        </TabLink>
      </div>

      <section style={card}>
        <header style={tableHeader}>
          <span style={{ width: 60 }}>종류</span>
          <span style={{ flex: 1 }}>제목</span>
          <span style={{ width: 140 }}>신청자</span>
          <span style={{ width: 100 }}>신청일</span>
          <span style={{ width: 80 }}>상태</span>
        </header>

        {(rows ?? []).length === 0 ? (
          <div style={empty}>결재할 문서가 없습니다.</div>
        ) : (
          (rows as Partial<ApprovalRow>[]).map((r, i, arr) => {
            const a = authorMap.get(r.author_id!);
            return (
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
                <span style={{ width: 140, fontSize: 13, color: "#4B5563" }}>
                  {a?.name ?? "-"}
                  {a?.dept ? (
                    <span style={{ color: "#9CA3AF" }}> · {a.dept}</span>
                  ) : null}
                </span>
                <span style={{ width: 100, fontSize: 12, color: "#6B7280" }}>
                  {formatDate(r.created_at)}
                </span>
                <span style={{ width: 80 }}>
                  <StatusBadge status={r.status as ApprovalStatus} />
                </span>
              </Link>
            );
          })
        )}
      </section>
    </main>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "6px 16px",
        borderRadius: 6,
        background: active ? "#1E1E1C" : "transparent",
        color: active ? "#fff" : "#9CA3AF",
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      {children}
    </Link>
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
