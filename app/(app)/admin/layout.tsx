import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <>
      <nav
        style={{
          borderBottom: "1px solid #E5E7EB",
          background: "#fff",
          padding: "12px 40px",
          display: "flex",
          gap: 16,
          fontSize: 13,
        }}
      >
        <strong style={{ color: "#1E1E1C" }}>조직 관리</strong>
        <Link href="/admin/members" style={{ color: "#6B7280" }}>
          멤버
        </Link>
      </nav>
      {children}
    </>
  );
}
