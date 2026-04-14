"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMemberAction, resendInviteAction } from "./actions";
import RoleBadge, { ExecutiveBadge } from "@/components/RoleBadge";

type Team = { id: string; name: string };
type Member = {
  id: string;
  email: string;
  name: string;
  dept: string | null;
  role: "member" | "manager" | "admin";
  manager_id: string | null;
  team_id: string | null;
  hire_date: string | null;
  is_executive: boolean;
};

export default function MemberRow({
  member,
  teams,
  teamName,
  last,
}: {
  member: Member;
  teams: Team[];
  teamName: string | null;
  last: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

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
          <div
            style={{
              fontWeight: 600,
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            {member.name}
            {member.is_executive && <ExecutiveBadge />}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{member.email}</div>
        </div>
        <div style={{ width: 100, color: "#4B5563" }}>
          {member.dept ?? "-"}
        </div>
        <div style={{ width: 120, color: "#4B5563" }}>
          {teamName ?? <span style={{ color: "#9CA3AF" }}>무소속</span>}
        </div>
        <div style={{ width: 90 }}>
          <RoleBadge role={member.role} />
        </div>
        <div style={{ width: 110, color: "#4B5563", fontSize: 12 }}>
          {member.hire_date ?? "-"}
        </div>
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
        padding: "14px 20px",
        fontSize: 13,
        background: "#FAFBFC",
        borderBottom: last ? "none" : "1px solid #F3F4F6",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{member.name}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{member.email}</div>
        </div>
        <input
          name="dept"
          defaultValue={member.dept ?? ""}
          placeholder="부서"
          style={{ ...input, width: 100 }}
        />
        <select
          name="team_id"
          defaultValue={member.team_id ?? ""}
          style={{ ...input, width: 120 }}
        >
          <option value="">무소속</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          name="role"
          defaultValue={member.role}
          style={{ ...input, width: 90 }}
        >
          <option value="member">멤버</option>
          <option value="manager">매니저</option>
          <option value="admin">관리자</option>
        </select>
        <input
          type="date"
          name="hire_date"
          defaultValue={member.hire_date ?? ""}
          style={{ ...input, width: 110 }}
        />
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
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <label
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            fontSize: 12,
            fontWeight: 600,
            color: "#4B5563",
          }}
        >
          <input
            type="checkbox"
            name="is_executive"
            defaultChecked={member.is_executive}
          />
          <span>대표 결재자로 지정 (전체 중 1명만)</span>
        </label>
        <ResendButton email={member.email} />
      </div>

      {err && (
        <div
          style={{
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
    </form>
  );
}

function ResendButton({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {msg && (
        <span style={{ fontSize: 11, color: "#6B7280" }}>{msg}</span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const res = await resendInviteAction(email);
            setMsg(
              res.error ? `재발송 실패: ${res.error}` : "초대 재발송 완료",
            );
          });
        }}
        style={{ ...btnMini, fontSize: 11 }}
      >
        초대 이메일 재발송
      </button>
    </div>
  );
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
