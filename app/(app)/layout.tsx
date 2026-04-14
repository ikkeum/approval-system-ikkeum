import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F4F5F7" }}>
      <Sidebar
        userName={profile?.name ?? user.email ?? "?"}
        isAdmin={profile?.role === "admin"}
      />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
