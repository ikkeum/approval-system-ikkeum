import { createClient } from "@/lib/supabase/server";
import StampPanel from "./StampPanel";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, dept, role, stamp_svg")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <main style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>
        프로필
      </h1>

      <section style={card}>
        <h2 style={h2}>내 정보</h2>
        <dl style={dlStyle}>
          <dt>이름</dt>
          <dd>{profile?.name}</dd>
          <dt>이메일</dt>
          <dd>{profile?.email}</dd>
          <dt>부서</dt>
          <dd>{profile?.dept ?? "-"}</dd>
          <dt>역할</dt>
          <dd>{profile?.role}</dd>
        </dl>
      </section>

      {profile && (
        <StampPanel name={profile.name} initialSvg={profile.stamp_svg} />
      )}
    </main>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  padding: 24,
  marginBottom: 16,
};

const h2: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 16,
};

const dlStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  rowGap: 8,
  fontSize: 14,
};
