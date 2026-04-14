"use client";

import { useActionState, useState } from "react";
import { createTeamAction, type TeamState } from "./actions";

type Candidate = { id: string; name: string; dept: string | null };

export default function CreateTeamCard({
  candidates,
}: {
  candidates: Candidate[];
}) {
  const [state, formAction, pending] = useActionState<TeamState, FormData>(
    createTeamAction,
    null,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div
        style={{
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700 }}>새 팀</h2>
          <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
            팀을 만들고 팀장을 지정하세요. 팀장은 소속 팀원의 결재자가 됩니다.
          </p>
        </div>
        <button onClick={() => setOpen(true)} style={btnPrimary}>
          + 팀 만들기
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} style={{ padding: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
        새 팀
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="팀명">
          <input name="name" required maxLength={40} style={input} placeholder="예: 개발팀" />
        </Field>
        <Field label="팀장 (선택)">
          <select name="leader_id" defaultValue="" style={input}>
            <option value="">나중에 지정</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.dept ? `(${c.dept})` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {state?.ok === false && <div style={err}>{state.error}</div>}
      {state?.ok === true && <div style={ok}>팀을 만들었습니다.</div>}

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          marginTop: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          style={btnOutline}
        >
          닫기
        </button>
        <button type="submit" disabled={pending} style={btnPrimary}>
          {pending ? "생성 중..." : "생성"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#6B7280",
          marginBottom: 6,
          display: "block",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1.5px solid #E5E7EB",
  fontSize: 14,
  outline: "none",
  background: "#FAFBFC",
  boxSizing: "border-box",
};
const btnPrimary: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 8,
  border: "none",
  background: "#185FA5",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const btnOutline: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 8,
  border: "1.5px solid #E5E7EB",
  background: "#fff",
  color: "#1E1E1C",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};
const err: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  background: "#FEF2F2",
  border: "1px solid #FCA5A5",
  color: "#DC2626",
  borderRadius: 8,
  fontSize: 13,
};
const ok: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  background: "#F0FDF4",
  border: "1px solid #4ADE80",
  color: "#166534",
  borderRadius: 8,
  fontSize: 13,
};
