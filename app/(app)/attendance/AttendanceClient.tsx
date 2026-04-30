"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  Settings,
  X,
} from "lucide-react";

type Attendance = {
  id: string;
  user_id: string;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  is_late: boolean;
};

type Member = { id: string; name: string };

const KST = "Asia/Seoul";

function ymd(year: number, month0: number, day: number) {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayKstStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: KST });
}

function fmtTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: KST,
  });
}

type Cell = {
  date: string;
  day: number;
  inMonth: boolean;
};

function buildMonthGrid(year: number, month0: number): Cell[] {
  const firstDow = new Date(year, month0, 1).getDay();
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const prevDays = new Date(year, month0, 0).getDate();
  const cells: Cell[] = [];

  for (let i = firstDow - 1; i >= 0; i--) {
    const d = prevDays - i;
    const py = month0 === 0 ? year - 1 : year;
    const pm = month0 === 0 ? 11 : month0 - 1;
    cells.push({ date: ymd(py, pm, d), day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: ymd(year, month0, d), day: d, inMonth: true });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    const ny = month0 === 11 ? year + 1 : year;
    const nm = month0 === 11 ? 0 : month0 + 1;
    cells.push({ date: ymd(ny, nm, nextDay), day: nextDay, inMonth: false });
    nextDay++;
  }
  return cells;
}

export default function AttendanceClient({
  currentUserId,
  isAdmin,
  canViewOthers,
  members,
  initialLateThreshold,
}: {
  currentUserId: string;
  isAdmin: boolean;
  canViewOthers: boolean;
  members: Member[];
  initialLateThreshold: string;
}) {
  const today = useMemo(() => new Date(), []);
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [myToday, setMyToday] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lateThreshold, setLateThreshold] = useState(initialLateThreshold);

  const todayStr = todayKstStr();
  const isViewingSelf = selectedUserId === currentUserId;

  const fetchAttendances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = ymd(year, month0, 1);
      const to = ymd(year, month0, new Date(year, month0 + 1, 0).getDate());
      const params = new URLSearchParams({ from, to });
      if (selectedUserId !== currentUserId)
        params.set("user_id", selectedUserId);
      const res = await fetch(`/api/attendance?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "조회 실패");
      setAttendances(json.attendances ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, [year, month0, selectedUserId, currentUserId]);

  const fetchMyToday = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance?from=${todayStr}&to=${todayStr}`);
      const json = await res.json();
      if (res.ok) {
        const list = (json.attendances ?? []) as Attendance[];
        setMyToday(list.find((a) => a.work_date === todayStr) ?? null);
      }
    } catch {
      // silent
    }
  }, [todayStr]);

  useEffect(() => {
    fetchAttendances();
  }, [fetchAttendances]);

  useEffect(() => {
    fetchMyToday();
  }, [fetchMyToday]);

  const handleCheckIn = async () => {
    setBusy("in");
    setError(null);
    try {
      const res = await fetch("/api/attendance/check-in", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "출근 실패");
      setMyToday(json.attendance);
      if (isViewingSelf) await fetchAttendances();
    } catch (e) {
      setError(e instanceof Error ? e.message : "출근 실패");
    } finally {
      setBusy(null);
    }
  };

  const handleCheckOut = async () => {
    setBusy("out");
    setError(null);
    try {
      const res = await fetch("/api/attendance/check-out", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "퇴근 실패");
      setMyToday(json.attendance);
      if (isViewingSelf) await fetchAttendances();
    } catch (e) {
      setError(e instanceof Error ? e.message : "퇴근 실패");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveSettings = async (next: string) => {
    const res = await fetch("/api/attendance/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lateThreshold: next }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "저장 실패");
    setLateThreshold(json.lateThreshold);
    setSettingsOpen(false);
  };

  const goPrev = () => {
    if (month0 === 0) {
      setYear(year - 1);
      setMonth0(11);
    } else {
      setMonth0(month0 - 1);
    }
  };
  const goNext = () => {
    if (month0 === 11) {
      setYear(year + 1);
      setMonth0(0);
    } else {
      setMonth0(month0 + 1);
    }
  };

  const cells = useMemo(() => buildMonthGrid(year, month0), [year, month0]);
  const byDate = useMemo(() => {
    const map = new Map<string, Attendance>();
    for (const a of attendances) map.set(a.work_date, a);
    return map;
  }, [attendances]);

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
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>근태</h1>
        {isAdmin && (
          <button
            onClick={() => setSettingsOpen(true)}
            style={iconBtn}
            title="근태 설정"
          >
            <Settings size={16} />
            <span>설정</span>
          </button>
        )}
      </header>

      <section style={{ ...card, padding: 24, marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                color: "#6B7280",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              오늘 ({todayStr})
            </div>
            <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
              <div>
                <span style={{ color: "#6B7280" }}>출근: </span>
                <strong
                  style={{
                    color: myToday?.is_late ? "#DC2626" : "#1E1E1C",
                  }}
                >
                  {fmtTime(myToday?.check_in_at ?? null)}
                </strong>
                {myToday?.is_late && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 11,
                      color: "#DC2626",
                      fontWeight: 700,
                    }}
                  >
                    지각
                  </span>
                )}
              </div>
              <div>
                <span style={{ color: "#6B7280" }}>퇴근: </span>
                <strong>{fmtTime(myToday?.check_out_at ?? null)}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleCheckIn}
              disabled={!!busy || !!myToday?.check_in_at}
              style={primaryBtn(!myToday?.check_in_at && !busy)}
            >
              <LogIn size={16} />
              {busy === "in" ? "..." : "출근"}
            </button>
            <button
              onClick={handleCheckOut}
              disabled={!!busy || !myToday?.check_in_at}
              style={primaryBtn(!!myToday?.check_in_at && !busy)}
            >
              <LogOut size={16} />
              {busy === "out" ? "..." : "퇴근"}
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
          지각 기준: {lateThreshold.slice(0, 5)} · 사내 네트워크에서만 등록
          가능
        </div>
      </section>

      <section style={card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #F3F4F6",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={goPrev} style={navBtn} aria-label="이전 달">
              <ChevronLeft size={18} />
            </button>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                minWidth: 110,
                textAlign: "center",
              }}
            >
              {year}년 {month0 + 1}월
            </div>
            <button onClick={goNext} style={navBtn} aria-label="다음 달">
              <ChevronRight size={18} />
            </button>
          </div>

          {canViewOthers && members.length > 0 && (
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={select}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === currentUserId ? `${m.name} (나)` : m.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            borderBottom: "1px solid #F3F4F6",
          }}
        >
          {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
            <div
              key={d}
              style={{
                padding: "10px 12px",
                fontSize: 12,
                fontWeight: 700,
                color: i === 0 ? "#DC2626" : i === 6 ? "#2563EB" : "#6B7280",
                textAlign: "center",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
          }}
        >
          {cells.map((c, i) => {
            const rec = byDate.get(c.date);
            const dow = i % 7;
            const isToday = c.date === todayStr;
            const isPast = c.date < todayStr;
            const missing =
              c.inMonth && isPast && rec?.check_in_at && !rec.check_out_at;
            return (
              <div
                key={c.date + i}
                style={{
                  minHeight: 88,
                  padding: 8,
                  borderRight: dow !== 6 ? "1px solid #F3F4F6" : "none",
                  borderBottom: i < 35 ? "1px solid #F3F4F6" : "none",
                  background: isToday ? "#EFF6FF" : "#fff",
                  opacity: c.inMonth ? 1 : 0.35,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: isToday ? 800 : 600,
                    color:
                      dow === 0
                        ? "#DC2626"
                        : dow === 6
                          ? "#2563EB"
                          : "#374151",
                    marginBottom: 6,
                  }}
                >
                  {c.day}
                </div>
                {c.inMonth && rec && (
                  <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                    {rec.check_in_at && (
                      <div
                        style={{
                          color: rec.is_late ? "#DC2626" : "#059669",
                          fontWeight: 600,
                        }}
                      >
                        ↑ {fmtTime(rec.check_in_at)}
                      </div>
                    )}
                    <div
                      style={{
                        color: rec.check_out_at ? "#1E1E1C" : "#9CA3AF",
                      }}
                    >
                      ↓ {fmtTime(rec.check_out_at)}
                    </div>
                    {missing && (
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 10,
                          color: "#D97706",
                          fontWeight: 700,
                        }}
                      >
                        미퇴근
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {loading && (
          <div
            style={{
              padding: "16px 20px",
              fontSize: 13,
              color: "#6B7280",
              textAlign: "center",
            }}
          >
            불러오는 중...
          </div>
        )}
      </section>

      {settingsOpen && isAdmin && (
        <SettingsModal
          initialThreshold={lateThreshold}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}
    </main>
  );
}

function SettingsModal({
  initialThreshold,
  onClose,
  onSave,
}: {
  initialThreshold: string;
  onClose: () => void;
  onSave: (threshold: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initialThreshold.slice(0, 5));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      await onSave(value);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>근태 설정</h2>
          <button onClick={onClose} style={iconBtn} aria-label="닫기">
            <X size={16} />
          </button>
        </div>
        <label
          style={{
            display: "block",
            fontSize: 13,
            color: "#374151",
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          지각 기준 시각
        </label>
        <input
          type="time"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #D1D5DB",
            borderRadius: 8,
            fontSize: 14,
          }}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280" }}>
          이 시각 이후 출근 등록 시 &quot;지각&quot;으로 표시됩니다 (예: 09:00).
        </div>
        {err && (
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
            {err}
          </div>
        )}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button onClick={onClose} style={ghostBtn}>
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...primaryBtn(!saving), opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  overflow: "hidden",
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
  padding: "10px 16px",
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 14,
  color: "#374151",
  cursor: "pointer",
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

const select: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 14,
  background: "#fff",
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
  width: 400,
  maxWidth: "90vw",
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
};
