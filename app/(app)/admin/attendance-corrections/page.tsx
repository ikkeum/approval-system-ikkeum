import { createAdminClient } from "@/lib/supabase/admin";
import AttendanceCorrectionsClient, {
  type CorrectionItem,
} from "./AttendanceCorrectionsClient";

export const dynamic = "force-dynamic";

export default async function AttendanceCorrectionsPage() {
  // 인증/권한 검증은 admin layout 에서 처리됨.
  const admin = createAdminClient();

  const { data: approvals } = await admin
    .from("approvals")
    .select("id, payload, decided_at, author_id")
    .eq("type", "attendance_correction")
    .eq("status", "APPROVED")
    .order("decided_at", { ascending: false });

  const items: CorrectionItem[] = await buildItems(admin, approvals ?? []);

  return <AttendanceCorrectionsClient initialItems={items} />;
}

async function buildItems(
  admin: ReturnType<typeof createAdminClient>,
  approvals: {
    id: number;
    payload: Record<string, unknown>;
    decided_at: string | null;
    author_id: string;
  }[],
): Promise<CorrectionItem[]> {
  if (approvals.length === 0) return [];

  const authorIds = Array.from(new Set(approvals.map((a) => a.author_id)));
  const approvalIds = approvals.map((a) => a.id);

  const [profilesRes, applicationsRes] = await Promise.all([
    admin.from("profiles").select("id, name").in("id", authorIds),
    admin
      .from("attendance_correction_applications")
      .select("approval_id, applied_at")
      .in("approval_id", approvalIds),
  ]);

  const nameById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.name as string]),
  );
  const appliedById = new Map(
    (applicationsRes.data ?? []).map((a) => [
      a.approval_id as number,
      a.applied_at as string,
    ]),
  );

  return approvals.map((a) => {
    const p = a.payload as {
      correction_date?: string;
      check_in_time?: string;
      check_out_time?: string;
      reason?: string;
    };
    return {
      approvalId: a.id,
      authorName: nameById.get(a.author_id) ?? "?",
      decidedAt: a.decided_at,
      correctionDate: p.correction_date ?? "",
      checkInTime: p.check_in_time ?? null,
      checkOutTime: p.check_out_time ?? null,
      reason: p.reason ?? "",
      appliedAt: appliedById.get(a.id) ?? null,
    };
  });
}
