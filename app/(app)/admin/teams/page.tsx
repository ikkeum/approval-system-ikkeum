import { createClient } from "@/lib/supabase/server";
import CreateTeamCard from "./CreateTeamCard";
import TeamRow from "./TeamRow";

export default async function TeamsPage() {
  const supabase = await createClient();

  const [{ data: teams }, { data: members }] = await Promise.all([
    supabase
      .from("teams")
      .select("id,name,leader_id,created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("id,name,dept,team_id")
      .order("name", { ascending: true }),
  ]);

  const memberList = members ?? [];
  const memberById = new Map(memberList.map((m) => [m.id, m]));
  const teamList = teams ?? [];

  // 팀별 멤버 수 집계
  const teamMemberCount = new Map<string, number>();
  memberList.forEach((m) => {
    if (m.team_id) {
      teamMemberCount.set(m.team_id, (teamMemberCount.get(m.team_id) ?? 0) + 1);
    }
  });

  const candidateLeaders = memberList.map((m) => ({
    id: m.id,
    name: m.name,
    dept: m.dept,
  }));

  return (
    <main
      style={{
        padding: "32px 40px",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>팀</h1>

      <section style={{ ...card, marginBottom: 24 }}>
        <CreateTeamCard candidates={candidateLeaders} />
      </section>

      <section style={card}>
        <header style={tableHeader}>
          <span style={{ flex: 1 }}>팀명</span>
          <span style={{ width: 200 }}>팀장</span>
          <span style={{ width: 80 }}>멤버 수</span>
          <span style={{ width: 140 }}></span>
        </header>

        {teamList.length === 0 ? (
          <div style={empty}>팀이 없습니다. 위에서 새 팀을 만들어보세요.</div>
        ) : (
          teamList.map((t, i) => (
            <TeamRow
              key={t.id}
              team={t}
              leaderName={
                t.leader_id ? memberById.get(t.leader_id)?.name ?? "-" : null
              }
              memberCount={teamMemberCount.get(t.id) ?? 0}
              candidates={candidateLeaders}
              last={i === teamList.length - 1}
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
