"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink } from "lucide-react";

export type CorrectionItem = {
  approvalId: number;
  authorName: string;
  decidedAt: string | null;
  correctionDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  reason: string;
  appliedAt: string | null;
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function AttendanceCorrectionsClient({
  initialItems,
}: {
  initialItems: CorrectionItem[];
}) {
  const router = useRouter();
  const [items] = useState(initialItems);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = async (approvalId: number) => {
    if (
      !confirm(
        `결재 #${approvalId} 의 정정 내용을 attendances 에 적용하시겠습니까?`,
      )
    )
      return;
    setBusyId(approvalId);
    setError(null);
    try {
      const res = await fetch(
        `/api/attendance/apply-correction/${approvalId}`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "적용 실패");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "적용 실패");
    } finally {
      setBusyId(null);
    }
  };

  const pending = items.filter((i) => !i.appliedAt);
  const applied = items.filter((i) => !!i.appliedAt);

  return (
    <main style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>근무시각 정정</h1>
        <div style={{ marginTop: 6, fontSize: 13, color: "#6B7280" }}>
          승인된 근무시각 조정 결재를 attendances 데이터에 적용합니다. 적용은
          1회만 가능합니다.
        </div>
      </header>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            background: "#FEE2E2",
            color: "#DC2626",
            fontSize: 13,
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      <Section title="적용 대기" items={pending} emptyText="적용 대기 결재가 없습니다.">
        {(it) => (
          <button
            onClick={() => apply(it.approvalId)}
            disabled={busyId === it.approvalId}
            style={{
              ...primaryBtn(busyId !== it.approvalId),
              opacity: busyId === it.approvalId ? 0.6 : 1,
            }}
          >
            {busyId === it.approvalId ? "적용 중..." : "적용"}
          </button>
        )}
      </Section>

      <div style={{ height: 24 }} />

      <Section
        title="적용 완료"
        items={applied}
        emptyText="아직 적용된 결재가 없습니다."
      >
        {(it) => (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: "#059669",
              fontWeight: 700,
            }}
          >
            <CheckCircle2 size={14} />
            {fmtDateTime(it.appliedAt)}
          </span>
        )}
      </Section>
    </main>
  );
}

function Section({
  title,
  items,
  emptyText,
  children,
}: {
  title: string;
  items: CorrectionItem[];
  emptyText: string;
  children: (it: CorrectionItem) => React.ReactNode;
}) {
  return (
    <section style={card}>
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid #F3F4F6",
          fontSize: 14,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {title}
        <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>
          ({items.length})
        </span>
      </div>
      {items.length === 0 ? (
        <div
          style={{
            padding: "24px 20px",
            textAlign: "center",
            color: "#9CA3AF",
            fontSize: 13,
          }}
        >
          {emptyText}
        </div>
      ) : (
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              <th style={th}>결재</th>
              <th style={th}>작성자</th>
              <th style={th}>정정 대상일</th>
              <th style={th}>출근 / 퇴근</th>
              <th style={th}>사유</th>
              <th style={th}>승인 시각</th>
              <th style={{ ...th, textAlign: "right" }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr
                key={it.approvalId}
                style={{ borderTop: "1px solid #F3F4F6" }}
              >
                <td style={td}>
                  <Link
                    href={`/approvals/${it.approvalId}`}
                    style={{
                      color: "#185FA5",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    #{it.approvalId}
                    <ExternalLink size={12} />
                  </Link>
                </td>
                <td style={td}>{it.authorName}</td>
                <td style={td}>{it.correctionDate}</td>
                <td style={td}>
                  {it.checkInTime ?? "-"} / {it.checkOutTime ?? "-"}
                </td>
                <td
                  style={{
                    ...td,
                    maxWidth: 280,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={it.reason}
                >
                  {it.reason}
                </td>
                <td style={td}>{fmtDateTime(it.decidedAt)}</td>
                <td style={{ ...td, textAlign: "right" }}>{children(it)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  overflow: "hidden",
};

const th: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  color: "#6B7280",
};

const td: React.CSSProperties = {
  padding: "12px 16px",
  color: "#1E1E1C",
  verticalAlign: "middle",
};

function primaryBtn(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    background: active ? "#185FA5" : "#9CA3AF",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: active ? "pointer" : "not-allowed",
  };
}
