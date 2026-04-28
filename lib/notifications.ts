import { createClient } from "@/lib/supabase/server";
import { sendDmCard } from "@/lib/google-chat";

type SB = Awaited<ReturnType<typeof createClient>>;

type ApprovalEvent = "submitted" | "approved" | "rejected" | "canceled";

const COPY = {
  pending_approver: { title: "🔔 결재 요청 1건이 도착했습니다", button: "확인하기" },
  approved_author: { title: "✅ 결재가 승인되었습니다", button: "확인하기" },
  rejected_author: { title: "❌ 결재가 반려되었습니다", button: "확인하기" },
  canceled_approver: { title: "↩️ 결재가 철회되었습니다", button: "확인하기" },
} as const;

type CopyKey = keyof typeof COPY;

function buildLink(id: number): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/approvals/${id}`;
}

async function emailOf(supabase: SB, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return data?.email ?? null;
}

/**
 * 결재 이벤트 발생 시 적절한 사용자에게 Chat DM 알림을 보낸다.
 * - 호출부는 fire-and-forget (이 함수는 throw 하지 않음).
 * - 이벤트별 수신자/카피는 현재 row 상태를 보고 결정한다:
 *   - submitted              → 현재 결재자 (PENDING)
 *   - approved (비-최종)     → 다음 결재자 (PENDING)
 *   - approved (최종)        → 작성자  (APPROVED)
 *   - rejected               → 작성자  (REJECTED)
 *   - canceled               → 직전 결재자 (CANCELED 직전 approver_id)
 */
export async function notifyApprovalEvent(
  id: number,
  event: ApprovalEvent,
): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: row } = await supabase
      .from("approvals")
      .select("status,author_id,approver_id")
      .eq("id", id)
      .maybeSingle();
    if (!row) return;

    let targetUserId: string | null = null;
    let copyKey: CopyKey | null = null;

    switch (event) {
      case "submitted":
        if (row.status !== "PENDING") return;
        targetUserId = row.approver_id;
        copyKey = "pending_approver";
        break;
      case "approved":
        if (row.status === "APPROVED") {
          targetUserId = row.author_id;
          copyKey = "approved_author";
        } else if (row.status === "PENDING") {
          targetUserId = row.approver_id;
          copyKey = "pending_approver";
        }
        break;
      case "rejected":
        if (row.status !== "REJECTED") return;
        targetUserId = row.author_id;
        copyKey = "rejected_author";
        break;
      case "canceled":
        if (row.status !== "CANCELED") return;
        targetUserId = row.approver_id;
        copyKey = "canceled_approver";
        break;
    }

    if (!targetUserId || !copyKey) return;
    const toEmail = await emailOf(supabase, targetUserId);
    if (!toEmail) return;

    const copy = COPY[copyKey];
    await sendDmCard(toEmail, {
      title: copy.title,
      buttonText: copy.button,
      buttonUrl: buildLink(id),
    });
  } catch (e) {
    console.error("[notify] failed", e);
  }
}
