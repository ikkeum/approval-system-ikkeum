import { createClient } from "@/lib/supabase/server";
import InviteForm from "./InviteForm";
import MemberRow from "./MemberRow";

export default async function MembersPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: teams }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id,email,name,dept,role,manager_id,hire_date,is_executive,team_id,created_at",
      )
      .order("created_at", { ascending: true }),
    supabase.from("teams").select("id,name").order("name"),
  ]);

  const list = members ?? [];
  const teamList = teams ?? [];
  const teamById = new Map(teamList.map((t) => [t.id, t]));

  return (
    <main
      style={{
        padding: "32px 40px",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>멤버</h1>
      </header>

      <section style={{ ...card, marginBottom: 24 }}>
        <InviteForm teams={teamList} />
      </section>

      <section style={card}>
        <header style={tableHeader}>
          <span style={{ flex: 1 }}>이름 / 이메일</span>
          <span style={{ width: 100 }}>부서</span>
          <span style={{ width: 120 }}>팀</span>
          <span style={{ width: 90 }}>역할</span>
          <span style={{ width: 110 }}>입사일</span>
          <span style={{ width: 140 }}></span>
        </header>

        {list.length === 0 ? (
          <div style={empty}>아직 멤버가 없습니다.</div>
        ) : (
          list.map((m, i) => (
            <MemberRow
              key={m.id}
              member={m}
              teams={teamList}
              teamName={m.team_id ? teamById.get(m.team_id)?.name ?? null : null}
              last={i === list.length - 1}
            />
          ))
        )}
      </section>
    </main>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  overflow: "hidden",
};
const tableHeader: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: "10px 20px",
  fontSize: 11,
  fontWeight: 700,
  color: "#9CA3AF",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  background: "#F9FAFB",
};
const empty: React.CSSProperties = {
  padding: "32px 20px",
  textAlign: "center",
  color: "#9CA3AF",
  fontSize: 13,
};
