import {
  type ApprovalStatus,
  STATUS_KO,
  STATUS_STYLE,
} from "@/lib/approvals";

export default function StatusBadge({ status }: { status: ApprovalStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {STATUS_KO[status]}
    </span>
  );
}

export function TypeTag({ type }: { type: "leave" | "expense" }) {
  const leave = type === "leave";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 700,
        background: leave ? "#EEF2FF" : "#FDF2F8",
        color: leave ? "#4338CA" : "#BE185D",
      }}
    >
      {leave ? "연차" : "품의"}
    </span>
  );
}
