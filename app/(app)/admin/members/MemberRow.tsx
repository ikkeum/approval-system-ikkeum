"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMemberAction, resendInviteAction } from "./actions";

type Candidate = { id: string; name: string; dept: string | null };
type Member = {
  id: string;
  email: string;
  name: string;
  dept: string | null;
  role: "member" | "manager" | "admin";
  manager_id: string | null;
};

const ROLE_LABEL: Record<Member["role"], string> = {
  member: "멤버",
  manager: "매니저",
  admin: "관리자",
};

export default function MemberRow({
  member,
  managerCandidates,
  last,
}: {
  member: Member;
  managerCandidates: Candidate[];
  last: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const managerName =
    managerCandidates.find((c) => c.id === member.manager_id)?.name ?? "-";

  const rowStyle: React.CSSProperties = {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: "14px 20px",
    fontSize: 13,
    borderBottom: last ? "none" : "1px solid #F3F4F6",
  };

  if (!editing) {
    return (
      <div style={rowStyle}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{member.name}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{member.email}</div>
        </div>
        <div style={{ width: 120, color: "#4B5563" }}>
          {member.dept ?? "-"}
        </div>
        <div style={{ width: 100 }}>
          <span style={roleBadge(member.role)}>{ROLE_LABEL[member.role]}</span>
        </div>
        <div style={{ width: 160, color: "#4B5563" }}>{managerName}</div>
        <div style={{ width: 140, textAlign: "right" }}>
          <button onClick={() => setEditing(true)} style={btnMini}>
            수정
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        fd.set("id", member.id);
        setErr(null);
        start(async () => {
          const res = await updateMemberAction(fd);
          if (res.error) setErr(res.error);
          else {
            setEditing(false);
            router.refresh();
          }
        });
      }}
      style={{
        ...rowStyle,
        background: "#FAFBFC",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{member.name}</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{member.email}</div>
      </div>
      <input
        name="dept"
        defaultValue={member.dept ?? ""}
        placeholder="부서"
        style={{ ...input, width: 120 }}
      />
      <select
        name="role"
        defaultValue={member.role}
        style={{ ...input, width: 100 }}
      >
        <option value="member">멤버</option>
        <option value="manager">매니저</option>
        <option value="admin">관리자</option>
      </select>
      <select
        name="manager_id"
        defaultValue={member.manager_id ?? ""}
        style={{ ...input, width: 160 }}
      >
        <option value="">없음</option>
        {managerCandidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.dept ? `(${c.dept})` : ""}
          </option>
        ))}
      </select>
      <div
        style={{
          display: "flex",
          gap: 6,
          width: 140,
          justifyContent: "flex-end",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          disabled={pending}
          onClick={() => setEditing(false)}
          style={btnMini}
        >
          취소
        </button>
        <button type="submit" disabled={pending} style={btnMiniPrimary}>
          저장
        </button>
      </div>
      {err && (
        <div
          style={{
            width: "100%",
            marginTop: 8,
            padding: "8px 10px",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#DC2626",
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          {err}
        </div>
      )}
      <ResendButton email={member.email} />
    </form>
  );
}

function ResendButton({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div style={{ width: "100%", marginTop: 6, textAlign: "right" }}>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const res = await resendInviteAction(email);
            setMsg(res.error ? `재발송 실패: ${res.error}` : "초대 재발송 완료");
          });
        }}
        style={{ ...btnMini, fontSize: 11 }}
      >
        초대 이메일 재발송
      </button>
      {msg && (
        <span style={{ marginLeft: 8, fontSize: 11, color: "#6B7280" }}>
          {msg}
        </span>
      )}
    </div>
  );
}

function roleBadge(role: Member["role"]): React.CSSProperties {
  const m = {
    admin: { bg: "#FEF3F2", fg: "#B42318", bd: "#FDA29B" },
    manager: { bg: "#EFF6FF", fg: "#1D4ED8", bd: "#93C5FD" },
    member: { bg: "#F3F4F6", fg: "#4B5563", bd: "#D1D5DB" },
  }[role];
  return {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    background: m.bg,
    color: m.fg,
    border: `1px solid ${m.bd}`,
  };
}

const input: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 6,
  border: "1.5px solid #E5E7EB",
  fontSize: 13,
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
};
const btnMini: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1.5px solid #E5E7EB",
  background: "#fff",
  color: "#1E1E1C",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const btnMiniPrimary: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "none",
  background: "#185FA5",
  color: "#fff",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
