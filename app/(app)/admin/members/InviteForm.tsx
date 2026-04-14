"use client";

import { useActionState, useState } from "react";
import { inviteMemberAction, type InviteState } from "./actions";

type Candidate = { id: string; name: string; dept: string | null };

export default function InviteForm({
  managerCandidates,
}: {
  managerCandidates: Candidate[];
}) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    inviteMemberAction,
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
          <h2 style={{ fontSize: 14, fontWeight: 700 }}>멤버 초대</h2>
          <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
            이메일로 초대하면 상대가 링크를 눌러 비밀번호를 설정하고 바로
            시작할 수 있습니다.
          </p>
        </div>
        <button onClick={() => setOpen(true)} style={btnPrimary}>
          + 초대
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} style={{ padding: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
        멤버 초대
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="이메일">
          <input
            type="email"
            name="email"
            required
            style={input}
            placeholder="name@회사도메인.com"
          />
        </Field>
        <Field label="이름">
          <input
            type="text"
            name="name"
            required
            maxLength={40}
            style={input}
            placeholder="홍길동"
          />
        </Field>
        <Field label="부서">
          <input type="text" name="dept" maxLength={40} style={input} />
        </Field>
        <Field label="역할">
          <select name="role" defaultValue="member" style={input}>
            <option value="member">멤버</option>
            <option value="manager">매니저</option>
            <option value="admin">관리자</option>
          </select>
        </Field>
        <Field label="담당 매니저 (선택)">
          <select name="manager_id" defaultValue="" style={input}>
            <option value="">없음</option>
            {managerCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.dept ? `(${c.dept})` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {state?.ok === false && (
        <div style={err}>{state.error}</div>
      )}
      {state?.ok === true && (
        <div style={ok}>초대 메일을 {state.email} 로 보냈습니다.</div>
      )}

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
          {pending ? "초대 중..." : "초대 메일 보내기"}
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
