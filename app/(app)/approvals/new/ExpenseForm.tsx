"use client";

import { useActionState } from "react";
import { createExpenseAction, type NewState } from "./actions";

const PURPOSES = ["장비구매", "외주비", "교육비", "출장비", "복리후생", "인프라/서버", "기타"];

export default function ExpenseForm() {
  const [state, formAction, pending] = useActionState<NewState, FormData>(
    createExpenseAction,
    null,
  );

  return (
    <form action={formAction} style={card}>
      <Field label="제목">
        <input name="title" required maxLength={80} style={input} placeholder="예: AWS 서버 증설 비용" />
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <Field label="금액 (원)" style={{ flex: 2 }}>
          <input type="number" name="amount" required min={0} step={100} style={input} />
        </Field>
        <Field label="용도" style={{ flex: 1 }}>
          <select name="purpose" required style={input}>
            {PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="상세 내용">
        <textarea
          name="content"
          required
          rows={5}
          maxLength={2000}
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
      <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "10px 12px", marginBottom: 16, background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", borderRadius: 8, fontSize: 13 }}>
      {msg}
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", padding: 28 };
const input: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none", background: "#FAFBFC", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { padding: "10px 22px", borderRadius: 8, border: "none", background: "#185FA5", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnOutline: React.CSSProperties = { padding: "10px 22px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#fff", color: "#1E1E1C", fontWeight: 600, fontSize: 13, cursor: "pointer" };
