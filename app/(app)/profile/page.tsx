import { createClient } from "@/lib/supabase/server";
import StampPanel from "./StampPanel";
import RoleBadge, { ExecutiveBadge, type Role } from "@/components/RoleBadge";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, dept, role, hire_date, is_executive, stamp_svg")
    .eq("id", user!.id)
    .maybeSingle();

  const tenure = profile?.hire_date
    ? tenureLabel(profile.hire_date)
    : null;

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
          <dd style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {profile?.role && <RoleBadge role={profile.role as Role} />}
            {profile?.is_executive && <ExecutiveBadge />}
          </dd>
          <dt>입사일</dt>
          <dd>
            {profile?.hire_date ?? "-"}
            {tenure && (
              <span style={{ color: "#6B7280", marginLeft: 8, fontSize: 13 }}>
                · 근속 {tenure}
              </span>
            )}
          </dd>
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

function tenureLabel(hire: string): string {
  const s = new Date(hire).getTime();
  if (Number.isNaN(s)) return "";
  const now = Date.now();
  const days = Math.max(0, Math.floor((now - s) / 86400000));
  const years = Math.floor(days / 365);
  const months = Math.floor((days - years * 365) / 30);
  if (years < 1) return `${months}개월`;
  return months === 0 ? `${years}년` : `${years}년 ${months}개월`;
}
