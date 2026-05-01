"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

type Holiday = {
  date: string;
  name: string;
  source: "public" | "manual";
};

export default function HolidaysClient() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/holidays?year=${year}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "조회 실패");
      setHolidays(json.holidays ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const handleSync = async () => {
    if (
      !confirm(
        `${year}년 공휴일을 공공데이터포털에서 동기화합니다. (manual 행은 보존됩니다)`,
      )
    )
      return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/holidays/sync?year=${year}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "동기화 실패");
      alert(
        `동기화 완료\n- fetched: ${json.fetched}\n- inserted: ${json.inserted}\n- deleted: ${json.deleted}`,
      );
      await fetchHolidays();
    } catch (e) {
      setError(e instanceof Error ? e.message : "동기화 실패");
    } finally {
      setSyncing(false);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, name: newName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "등록 실패");
      setNewDate("");
      setNewName("");
      setAddOpen(false);
      await fetchHolidays();
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (date: string, name: string) => {
    if (!confirm(`${date} ${name} 을(를) 삭제하시겠습니까?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/holidays/${date}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "삭제 실패");
      await fetchHolidays();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    }
  };

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
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>휴일 관리</h1>
      </header>

      <section style={{ ...card, padding: 20, marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setYear(year - 1)}
              style={navBtn}
              aria-label="이전 해"
            >
              <ChevronLeft size={18} />
            </button>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                minWidth: 80,
                textAlign: "center",
              }}
            >
              {year}년
            </div>
            <button
              onClick={() => setYear(year + 1)}
              style={navBtn}
              aria-label="다음 해"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{ ...primaryBtn(!syncing), opacity: syncing ? 0.6 : 1 }}
            >
              <RefreshCw size={16} />
              {syncing ? "동기화 중..." : "공공API 동기화"}
            </button>
            <button onClick={() => setAddOpen(true)} style={ghostBtn}>
              <Plus size={16} />
              수동 등록
            </button>
          </div>
        </div>
        {error && (
          <div
            style={{
              marginTop: 12,
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
        <div style={{ marginTop: 12, fontSize: 12, color: "#9CA3AF" }}>
          공공API 동기화는 source=public 행만 교체합니다. 사내 휴일(manual)은
          보존됩니다.
        </div>
      </section>

      <section style={card}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
        >
          <thead>
            <tr
              style={{
                background: "#F9FAFB",
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              <th style={th}>날짜</th>
              <th style={th}>이름</th>
              <th style={th}>출처</th>
              <th style={{ ...th, textAlign: "right" }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: 20,
                    textAlign: "center",
                    color: "#6B7280",
                  }}
                >
                  불러오는 중...
                </td>
              </tr>
            )}
            {!loading && holidays.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: 20,
                    textAlign: "center",
                    color: "#9CA3AF",
                  }}
                >
                  {year}년 등록된 휴일이 없습니다.
                </td>
              </tr>
            )}
            {holidays.map((h) => (
              <tr key={h.date} style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={td}>{h.date}</td>
                <td style={td}>{h.name}</td>
                <td style={td}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background:
                        h.source === "public" ? "#DBEAFE" : "#FEF3C7",
                      color: h.source === "public" ? "#1D4ED8" : "#92400E",
                    }}
                  >
                    {h.source === "public" ? "공공" : "수동"}
                  </span>
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  <button
                    onClick={() => handleDelete(h.date, h.name)}
                    style={iconBtnDanger}
                    aria-label="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {addOpen && (
        <div style={modalBackdrop} onClick={() => setAddOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>휴일 수동 등록</h2>
              <button
                onClick={() => setAddOpen(false)}
                style={iconBtn}
                aria-label="닫기"
              >
                <X size={16} />
              </button>
            </div>
            <label style={label}>날짜</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              style={input}
            />
            <label style={{ ...label, marginTop: 12 }}>이름</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 회사 창립일"
              style={input}
              maxLength={100}
            />
            <div
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button onClick={() => setAddOpen(false)} style={ghostBtn}>
                취소
              </button>
              <button
                onClick={handleAdd}
                disabled={adding || !newDate || !newName.trim()}
                style={{
                  ...primaryBtn(
                    !adding && !!newDate && !!newName.trim(),
                  ),
                  opacity: adding ? 0.6 : 1,
                }}
              >
                {adding ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
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
};

const navBtn: React.CSSProperties = {
  padding: 6,
  background: "transparent",
  border: "1px solid #E5E7EB",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const iconBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 13,
  cursor: "pointer",
  color: "#374151",
};

const iconBtnDanger: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  background: "#fff",
  border: "1px solid #FCA5A5",
  borderRadius: 6,
  cursor: "pointer",
  color: "#DC2626",
};

function primaryBtn(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 18px",
    background: active ? "#185FA5" : "#9CA3AF",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: active ? "pointer" : "not-allowed",
  };
}

const ghostBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 16px",
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 14,
  color: "#374151",
  cursor: "pointer",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#374151",
  fontWeight: 600,
  marginBottom: 6,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  fontSize: 14,
};

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
};

const modalCard: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: 24,
  width: 420,
  maxWidth: "90vw",
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
};
