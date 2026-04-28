"use client";

import { useActionState } from "react";
import type { NewState } from "./actions";
import ApproverPicker from "./ApproverPicker";
import type { ApproverCandidate } from "@/lib/approvers";

type Field =
  | { kind: "date"; name: string; label: string; required?: boolean }
  | {
      kind: "text";
      name: string;
      label: string;
      required?: boolean;
      placeholder?: string;
      maxLength?: number;
    }
  | {
      kind: "textarea";
      name: string;
      label: string;
      required?: boolean;
      rows?: number;
      maxLength?: number;
    }
  | {
      kind: "number";
      name: string;
      label: string;
      required?: boolean;
      min?: number;
      max?: number;
      defaultValue?: number;
    }
  | { kind: "daterange"; startName: string; endName: string; label: string }
  | { kind: "row"; children: Field[] };

export default function SimpleForm({
  fields,
  action,
  candidates,
  defaultApproverId,
}: {
  fields: Field[];
  action: (_prev: NewState, fd: FormData) => Promise<NewState>;
  candidates: ApproverCandidate[];
  defaultApproverId: string | null;
}) {
  const [state, formAction, pending] = useActionState<NewState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} style={card}>
      {fields.map((f, i) => renderField(f, i))}
      <ApproverPicker
        candidates={candidates}
        defaultApproverId={defaultApproverId}
      />
      {state?.error && <Err msg={state.error} />}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="submit"
          name="submit"
          value="0"
          disabled={pending}
          style={btnOutline}
        >
          임시저장
        </button>
        <button
          type="submit"
          name="submit"
          value="1"
          disabled={pending}
          style={btnPrimary}
        >
          {pending ? "제출 중..." : "제출"}
        </button>
      </div>
    </form>
  );
}

function renderField(f: Field, key: React.Key): React.ReactElement {
  if (f.kind === "row") {
    return (
      <div key={key} style={{ display: "flex", gap: 12 }}>
        {f.children.map((c, i) => (
          <div key={i} style={{ flex: 1 }}>
            {renderField(c, i)}
          </div>
        ))}
      </div>
    );
  }
  if (f.kind === "daterange") {
    return (
      <FieldWrap key={key} label={f.label}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" name={f.startName} required style={input} />
          <span style={{ color: "#9CA3AF" }}>~</span>
          <input type="date" name={f.endName} required style={input} />
        </div>
      </FieldWrap>
    );
  }
  return (
    <FieldWrap key={key} label={f.label}>
      {f.kind === "text" && (
        <input
          name={f.name}
          required={f.required}
          maxLength={f.maxLength}
          placeholder={f.placeholder}
          style={input}
        />
      )}
      {f.kind === "date" && (
        <input
          type="date"
          name={f.name}
          required={f.required}
          style={input}
        />
      )}
      {f.kind === "textarea" && (
        <textarea
          name={f.name}
          required={f.required}
          rows={f.rows ?? 4}
          maxLength={f.maxLength}
          style={{ ...input, resize: "vertical" }}
        />
      )}
      {f.kind === "number" && (
        <input
          type="number"
          name={f.name}
          required={f.required}
          min={f.min}
          max={f.max}
          defaultValue={f.defaultValue}
          style={input}
        />
      )}
    </FieldWrap>
  );
}

function FieldWrap({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
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
