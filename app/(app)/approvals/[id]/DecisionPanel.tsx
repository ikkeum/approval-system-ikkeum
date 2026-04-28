"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveAction,
  rejectAction,
  cancelAction,
  submitAction,
  deleteDraftAction,
} from "./actions";
import type { ApproverCandidate } from "@/lib/approvers";

type Mode =
  | { kind: "approver"; status: "PENDING" }
  | {
      kind: "author_draft";
      candidates: ApproverCandidate[];
      defaultApproverId: string | null;
    }
  | { kind: "author_pending" }
  | { kind: "readonly" };

export default function DecisionPanel({
  id,
  mode,
}: {
  id: number;
  mode: Mode;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [approverId, setApproverId] = useState<string>(
    mode.kind === "author_draft" ? (mode.defaultApproverId ?? "") : "",
  );
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function wrap(fn: () => Promise<{ error?: string } | void>) {
    return () => {
      setErr(null);
      startTransition(async () => {
        const res = await fn();
        if (res && res.error) setErr(res.error);
        else router.refresh();
      });
    };
  }

  if (mode.kind === "readonly") return null;

  return (
    <section style={card}>
      {mode.kind === "approver" && (
        <>
          <h2 style={h2}>결재 처리</h2>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="의견 (반려 시 필수)"
            rows={3}
            style={input}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button
              disabled={pending}
              onClick={wrap(() => rejectAction(id, comment))}
              style={btnDanger}
            >
              반려
            </button>
            <button
              disabled={pending}
              onClick={wrap(() => approveAction(id, comment))}
              style={btnPrimary}
            >
              승인
            </button>
          </div>
        </>
      )}

      {mode.kind === "author_draft" && (
        <>
          <h2 style={h2}>제출 / 삭제</h2>
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
            제출하면 본인(기안) → 선택한 결재자 순으로 결재가 진행됩니다.
          </p>
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#6B7280",
              marginBottom: 6,
              display: "block",
            }}
          >
            결재자
          </label>
          <select
            value={approverId}
            onChange={(e) => setApproverId(e.target.value)}
            style={input}
          >
            {!mode.defaultApproverId && (
              <option value="">결재자를 선택하세요</option>
            )}
            {mode.candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.is_executive ? " · 대표" : c.dept ? ` · ${c.dept}` : ""}
              </option>
            ))}
          </select>
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 12,
            }}
          >
            <button
              disabled={pending}
              onClick={wrap(() => deleteDraftAction(id))}
              style={btnDanger}
            >
              삭제
            </button>
            <button
              disabled={pending || !approverId}
              onClick={wrap(() => submitAction(id, approverId || null))}
              style={btnPrimary}
            >
              제출
            </button>
          </div>
        </>
      )}

      {mode.kind === "author_pending" && (
        <>
          <h2 style={h2}>철회</h2>
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
            결재자가 처리하기 전까지 철회할 수 있습니다. 철회하면 종결 처리되며
            다시 살릴 수 없습니다.
          </p>
          <button
            disabled={pending}
            onClick={wrap(() => cancelAction(id))}
            style={btnOutline}
          >
            철회
          </button>
        </>
      )}

      {err && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#DC2626",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}
    </section>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  padding: 20,
  marginTop: 16,
};
const h2: React.CSSProperties = { fontSize: 14, fontWeight: 700, marginBottom: 12 };
const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1.5px solid #E5E7EB",
  fontSize: 14,
  outline: "none",
  background: "#FAFBFC",
  boxSizing: "border-box",
  resize: "vertical",
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
const btnDanger: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: 8,
  border: "1.5px solid #FCA5A5",
  background: "#fff",
  color: "#DC2626",
  fontWeight: 600,
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
