import type { createClient } from "@/lib/supabase/server";

type SB = Awaited<ReturnType<typeof createClient>>;

export type ApproverCandidate = {
  id: string;
  name: string;
  dept: string | null;
  role: string;
  is_executive: boolean;
};

export async function listApproverCandidates(
  supabase: SB,
  excludeId: string,
): Promise<ApproverCandidate[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id,name,dept,role,is_executive")
    .neq("id", excludeId)
    .order("name", { ascending: true });
  return (data ?? []) as ApproverCandidate[];
}

export async function autoRoutedApproverId(
  supabase: SB,
  authorId: string,
): Promise<string | null> {
  const { data: author } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", authorId)
    .maybeSingle();
  if (author?.team_id) {
    const { data: team } = await supabase
      .from("teams")
      .select("leader_id")
      .eq("id", author.team_id)
      .maybeSingle();
    if (team?.leader_id && team.leader_id !== authorId) return team.leader_id;
  }
  const { data: exec } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_executive", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return exec?.id ?? null;
}

export async function resolveApproverId(
  supabase: SB,
  authorId: string,
  chosenId: string | null,
): Promise<{ id: string | null; error?: string }> {
  if (chosenId) {
    if (chosenId === authorId)
      return { id: null, error: "본인을 결재자로 지정할 수 없습니다." };
    const { data: chosen } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", chosenId)
      .maybeSingle();
    if (!chosen)
      return { id: null, error: "결재 대상자가 존재하지 않습니다." };
    return { id: chosenId };
  }
  const id = await autoRoutedApproverId(supabase, authorId);
  if (!id)
    return {
      id: null,
      error: "결재자를 결정할 수 없습니다. 관리자에게 문의하세요.",
    };
  if (id === authorId)
    return {
      id: null,
      error: "본인이 결재 대상입니다. 관리자에게 결재 라인 설정을 요청하세요.",
    };
  return { id };
}

export function approverLabel(p: ApproverCandidate): string {
  const tag = p.is_executive ? " · 대표" : p.dept ? ` · ${p.dept}` : "";
  return `${p.name}${tag}`;
}
