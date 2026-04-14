import {
  type ApprovalStatus,
  type ApprovalType,
  STATUS_KO,
  STATUS_STYLE,
  TYPE_KO,
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

const TYPE_STYLE: Record<ApprovalType, { bg: string; fg: string }> = {
  leave: { bg: "#EEF2FF", fg: "#4338CA" },
  expense: { bg: "#FDF2F8", fg: "#BE185D" },
  leave_of_absence: { bg: "#FEF3C7", fg: "#92400E" },
  reinstatement: { bg: "#D1FAE5", fg: "#065F46" },
  employment_cert: { bg: "#E0E7FF", fg: "#3730A3" },
  career_cert: { bg: "#F3E8FF", fg: "#6B21A8" },
};

export function TypeTag({ type }: { type: ApprovalType }) {
  const s = TYPE_STYLE[type] ?? { bg: "#F3F4F6", fg: "#4B5563" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 700,
        background: s.bg,
        color: s.fg,
        whiteSpace: "nowrap",
      }}
    >
      {TYPE_KO[type]}
    </span>
  );
}
