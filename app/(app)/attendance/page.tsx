import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AttendanceClient from "./AttendanceClient";

export default async function AttendancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, leadingTeamsRes, settingsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("teams").select("id").eq("leader_id", user.id),
    supabase
      .from("attendance_settings")
      .select("late_threshold")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const isAdmin = profileRes.data?.role === "admin";
  const isTeamLeader = (leadingTeamsRes.data ?? []).length > 0;
  const canViewOthers = isAdmin || isTeamLeader;

  let members: { id: string; name: string }[] = [];
  if (canViewOthers) {
    const { data } = await supabase
      .from("profiles")
      .select("id, name")
      .order("name");
    members = data ?? [];
  }

  return (
    <AttendanceClient
      currentUserId={user.id}
      isAdmin={isAdmin}
      canViewOthers={canViewOthers}
      members={members}
      initialLateThreshold={settingsRes.data?.late_threshold ?? "09:00:00"}
    />
  );
}
