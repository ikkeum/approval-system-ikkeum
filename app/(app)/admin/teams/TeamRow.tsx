"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTeamAction, deleteTeamAction } from "./actions";

type Candidate = { id: string; name: string; dept: string | null };
type Team = {
  id: string;
  name: string;
  leader_id: string | null;
};

export default function TeamRow({
  team,
  leaderName,
  memberCount,
  candidates,
  last,
}: {
  team: Team;
  leaderName: string | null;
  memberCount: number;
  candidates: Candidate[];
  last: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const rowStyle: React.CSSProperties = {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: "14px 20px",
    fontSize: 13,
    borderBottom: last ? "none" : "1px solid #F3F4F6",
  };

  if (!editing) {
    return (
      <div style={rowStyle}>
        <div style={{ flex: 1, fontWeight: 600 }}>{team.name}</div>
        <div style={{ width: 200, color: "#4B5563" }}>{leaderName ?? "-"}</div>
        <div style={{ width: 80, color: "#4B5563" }}>{memberCount}명</div>
        <div
          style={{
            width: 140,
            textAlign: "right",
            display: "flex",
            gap: 6,
            justifyContent: "flex-end",
          }}
        >
          <button onClick={() => setEditing(true)} style={btnMini}>
            수정
          </button>
          <button
            disabled={pending || memberCount > 0}
            title={
              memberCount > 0
                ? "소속 멤버를 먼저 다른 팀으로 이동"
                : "팀 삭제"
            }
            onClick={() => {
              setErr(null);
              start(async () => {
                if (!confirm(`'${team.name}' 팀을 삭제할까요?`)) return;
                const res = await deleteTeamAction(team.id);
                if (res.error) setErr(res.error);
                else router.refresh();
              });
            }}
            style={btnMiniDanger}
          >
            삭제
          </button>
        </div>
        {err && (
          <div style={{ width: "100%", color: "#DC2626", fontSize: 12 }}>
            {err}
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        fd.set("id", team.id);
        setErr(null);
        start(async () => {
          const res = await updateTeamAction(fd);
          if (res.error) setErr(res.error);
          else {
            setEditing(false);
            router.refresh();
          }
        });
      }}
      style={{ ...rowStyle, background: "#FAFBFC", flexWrap: "wrap" }}
    >
      <input
        name="name"
        defaultValue={team.name}
        required
        maxLength={40}
        style={{ ...input, flex: 1 }}
      />
      <select
        name="leader_id"
        defaultValue={team.leader_id ?? ""}
        style={{ ...input, width: 200 }}
      >
        <option value="">팀장 없음</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.dept ? `(${c.dept})` : ""}
          </option>
        ))}
      </select>
      <div style={{ width: 80, color: "#4B5563" }}>{memberCount}명</div>
      <div
        style={{
          width: 140,
          display: "flex",
          gap: 6,
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          disabled={pending}
          onClick={() => setEditing(false)}
          style={btnMini}
        >
          취소
        </button>
        <button type="submit" disabled={pending} style={btnMiniPrimary}>
          저장
        </button>
      </div>
      {err && (
        <div
          style={{
            width: "100%",
            marginTop: 8,
            padding: "8px 10px",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#DC2626",
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          {err}
        </div>
      )}
    </form>
  );
}

const input: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 6,
  border: "1.5px solid #E5E7EB",
  fontSize: 13,
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
};
const btnMini: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1.5px solid #E5E7EB",
  background: "#fff",
  color: "#1E1E1C",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const btnMiniPrimary: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "none",
  background: "#185FA5",
  color: "#fff",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const btnMiniDanger: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1.5px solid #FCA5A5",
  background: "#fff",
  color: "#DC2626",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
