"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertAdmin(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요" };
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") return { error: "admin 전용 기능입니다." };
  return {};
}

const CreateTeamInput = z.object({
  name: z.string().min(1).max(40),
  leader_id: z.string().uuid().optional().or(z.literal("")),
});

export type TeamState =
  | { ok: true; id: string }
  | { ok: false; error: string }
  | null;

export async function createTeamAction(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const auth = await assertAdmin();
  if (auth.error) return { ok: false, error: auth.error };

  const parsed = CreateTeamInput.safeParse({
    name: formData.get("name"),
    leader_id: formData.get("leader_id") || "",
  });
  if (!parsed.success) return { ok: false, error: "입력값을 확인해주세요." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teams")
    .insert({
      name: parsed.data.name,
      leader_id: parsed.data.leader_id || null,
    })
    .select("id")
    .single();

  if (error) {
    if (/duplicate/i.test(error.message)) {
      return { ok: false, error: "같은 이름의 팀이 이미 있습니다." };
    }
    return { ok: false, error: error.message };
  }

  // 팀장으로 지정된 사람을 해당 팀에 자동 소속시킴
  if (parsed.data.leader_id) {
    await admin
      .from("profiles")
      .update({ team_id: data!.id })
      .eq("id", parsed.data.leader_id);
  }

  revalidatePath("/admin/teams");
  return { ok: true, id: data!.id };
}

const UpdateTeamInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(40),
  leader_id: z.string().uuid().optional().or(z.literal("")),
});

export async function updateTeamAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const auth = await assertAdmin();
  if (auth.error) return { error: auth.error };

  const parsed = UpdateTeamInput.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    leader_id: formData.get("leader_id") || "",
  });
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("teams")
    .update({
      name: parsed.data.name,
      leader_id: parsed.data.leader_id || null,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  // 새 팀장을 해당 팀에 자동 소속
  if (parsed.data.leader_id) {
    await admin
      .from("profiles")
      .update({ team_id: parsed.data.id })
      .eq("id", parsed.data.leader_id);
  }

  revalidatePath("/admin/teams");
  revalidatePath("/admin/members");
  return {};
}

export async function deleteTeamAction(
  id: string,
): Promise<{ error?: string }> {
  const auth = await assertAdmin();
  if (auth.error) return { error: auth.error };

  const admin = createAdminClient();
  // 소속 멤버가 있으면 삭제 차단 (데이터 무결성)
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("team_id", id);
  if ((count ?? 0) > 0) {
    return {
      error: "소속 멤버가 있는 팀은 삭제할 수 없습니다. 먼저 멤버를 이동하세요.",
    };
  }

  const { error } = await admin.from("teams").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/teams");
  return {};
}
