import type { createClient } from "@/lib/supabase/server";
import type { ChainStep, ChainStepMode } from "@/lib/templates";

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

export function approverLabel(p: ApproverCandidate): string {
  const tag = p.is_executive ? " · 대표" : p.dept ? ` · ${p.dept}` : "";
  return `${p.name}${tag}`;
}

// ============================================================================
// 체인 기반 결재자 해석 (Phase 2)
// ============================================================================

export type ResolvedStep = {
  index: number;
  approver_id: string;
  mode: ChainStepMode;
};

export type ChainResolution =
  | { ok: true; steps: ResolvedStep[] }
  | { ok: false; error: string };

/**
 * 체인의 각 단계에 대해 결재자 ID를 결정한다.
 *
 * - author     → authorId
 * - fixed      → step.approver_id (admin이 박은 사용자)
 * - team_leader→ 작성자 팀의 leader_id
 * - executive  → is_executive=true (생성순 첫번째)
 * - picker     → pickerSelections[step.index]
 *
 * 본인 결재 방지: author 모드 외 단계의 결재자가 author 자신이면 에러.
 */
export async function resolveChainApprovers(
  supabase: SB,
  chain: ChainStep[],
  authorId: string,
  pickerSelections: Record<number, string>,
): Promise<ChainResolution> {
  let leaderId: string | null | undefined; // undefined = 미조회
  let execId: string | null | undefined;

  const resolved: ResolvedStep[] = [];

  for (const step of chain) {
    let approverId: string | null = null;

    switch (step.mode) {
      case "author":
        approverId = authorId;
        break;

      case "fixed":
        approverId = step.approver_id ?? null;
        if (!approverId)
          return {
            ok: false,
            error: `${step.label} 단계 설정이 잘못되어 있습니다. (관리자 문의)`,
          };
        break;

      case "team_leader":
        if (leaderId === undefined) {
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
            leaderId = team?.leader_id ?? null;
          } else {
            leaderId = null;
          }
        }
        approverId = leaderId ?? null;
        if (!approverId)
          return {
            ok: false,
            error: `${step.label} 단계의 팀장을 찾을 수 없습니다. (팀 미배정 또는 팀장 미지정)`,
          };
        break;

      case "executive":
        if (execId === undefined) {
          const { data: exec } = await supabase
            .from("profiles")
            .select("id")
            .eq("is_executive", true)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          execId = exec?.id ?? null;
        }
        approverId = execId ?? null;
        if (!approverId)
          return {
            ok: false,
            error: `${step.label} 단계의 대표(최종 결재자)가 지정되어 있지 않습니다.`,
          };
        break;

      case "picker": {
        const chosen = pickerSelections[step.index];
        if (!chosen)
          return {
            ok: false,
            error: `${step.label} 단계의 결재자를 선택해주세요.`,
          };
        approverId = chosen;
        break;
      }
    }

    if (!approverId) {
      return {
        ok: false,
        error: `${step.label} 단계의 결재자를 결정할 수 없습니다.`,
      };
    }

    if (step.mode !== "author" && approverId === authorId) {
      return {
        ok: false,
        error: `${step.label} 단계에 본인을 지정할 수 없습니다.`,
      };
    }

    resolved.push({ index: step.index, approver_id: approverId, mode: step.mode });
  }

  // picker로 선택된 ID가 실재 프로필인지 일괄 검증
  const pickerIds = resolved
    .filter((s) => s.mode === "picker")
    .map((s) => s.approver_id);
  if (pickerIds.length > 0) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .in("id", pickerIds);
    const existingSet = new Set((existing ?? []).map((p) => p.id));
    for (const id of pickerIds) {
      if (!existingSet.has(id))
        return { ok: false, error: "결재 대상자가 존재하지 않습니다." };
    }
  }

  return { ok: true, steps: resolved };
}
