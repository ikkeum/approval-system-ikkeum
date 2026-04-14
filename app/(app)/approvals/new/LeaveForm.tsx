"use client";

import { useActionState, useState } from "react";
import { createLeaveAction, type NewState } from "./actions";

type Approver = { id: string; name: string; dept: string | null };

export default function LeaveForm({
  approvers,
  defaultApproverId,
}: {
  approvers: Approver[];
  defaultApproverId: string | null;
}) {
  const [state, formAction, pending] = useActionState<NewState, FormData>(
    createLeaveAction,
    null,
  );
  const [leaveType, setLeaveType] = useState<"연차" | "오전반차" | "오후반차">(
    "연차",
  );

  return (
    <form action={formAction} style={card}>
      <Field label="결재자">
        <select name="approver_id" defaultValue={defaultApproverId ?? ""} style={input} required>
          <option value="">선택</option>
          {approvers.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} {a.dept ? `(${a.dept})` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field label="유형">
        <select
          name="leaveType"
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value as "연차")}
          style={input}
        >
          <option value="연차">연차</option>
          <option value="오전반차">오전반차</option>
          <option value="오후반차">오후반차</option>
        </select>
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <Field label="시작일" style={{ flex: 1 }}>
          <input type="date" name="start" required style={input} />
        </Field>
        <Field label="종료일" style={{ flex: 1 }}>
          <input type="date" name="end" required style={input} />
        </Field>
      </div>
      {leaveType !== "연차" && (
        <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: -8, marginBottom: 14 }}>
          반차는 0.5일로 자동 계산됩니다. 시작=종료 동일 날짜로 입력하세요.
        </p>
      )}

      <Field label="사유">
        <textarea
          name="reason"
          required
          rows={3}
          maxLength={500}
          style={{ ...input, resize: "vertical" }}
        />
      </Field>

      {state?.error && <Err msg={state.error} />}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="submit" name="submit" value="0" disabled={pending} style={btnOutline}>
          임시저장
        </button>
        <button type="submit" name="submit" value="1" disabled={pending} style={btnPrimary}>
          {pending ? "제출 중..." : "제출"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
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

function Err({ msg }: { msg: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        marginBottom: 16,
        background: "#FEF2F2",
        border: "1px solid #FCA5A5",
        color: "#DC2626",
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      {msg}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  padding: 28,
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1.5px solid #E5E7EB",
  fontSize: 14,
  outline: "none",
  background: "#FAFBFC",
  boxSizing: "border-box",
};
const btnPrimary: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: 8,
  border: "none",
  background: "#185FA5",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const btnOutline: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: 8,
  border: "1.5px solid #E5E7EB",
  background: "#fff",
  color: "#1E1E1C",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};
