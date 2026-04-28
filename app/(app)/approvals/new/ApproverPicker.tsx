"use client";

import type { ApproverCandidate } from "@/lib/approvers";

export default function ApproverPicker({
  candidates,
  defaultApproverId,
}: {
  candidates: ApproverCandidate[];
  defaultApproverId: string | null;
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
        결재자
      </label>
      <select
        name="approverId"
        required
        defaultValue={defaultApproverId ?? ""}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 8,
          border: "1.5px solid #E5E7EB",
          fontSize: 14,
          outline: "none",
          background: "#FAFBFC",
          boxSizing: "border-box",
        }}
      >
        {!defaultApproverId && <option value="">결재자를 선택하세요</option>}
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.is_executive ? " · 대표" : c.dept ? ` · ${c.dept}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
