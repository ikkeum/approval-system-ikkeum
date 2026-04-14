export type Role = "member" | "manager" | "admin";

const LABEL: Record<Role, string> = {
  member: "멤버",
  manager: "매니저",
  admin: "관리자",
};

const PALETTE: Record<Role, { bg: string; fg: string; bd: string }> = {
  admin: { bg: "#FEF3F2", fg: "#B42318", bd: "#FDA29B" },
  manager: { bg: "#EFF6FF", fg: "#1D4ED8", bd: "#93C5FD" },
  member: { bg: "#F3F4F6", fg: "#4B5563", bd: "#D1D5DB" },
};

export default function RoleBadge({ role }: { role: Role }) {
  const p = PALETTE[role];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        background: p.bg,
        color: p.fg,
        border: `1px solid ${p.bd}`,
        whiteSpace: "nowrap",
      }}
    >
      {LABEL[role]}
    </span>
  );
}

export function ExecutiveBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        background: "#FEF3F2",
        color: "#B42318",
        border: "1px solid #FDA29B",
        whiteSpace: "nowrap",
      }}
    >
      대표
    </span>
  );
}
