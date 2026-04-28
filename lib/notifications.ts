import { createClient } from "@/lib/supabase/server";
import { sendMail } from "@/lib/google-mail";

type SB = Awaited<ReturnType<typeof createClient>>;

type ApprovalEvent = "submitted" | "approved" | "rejected" | "canceled";

type CopyEntry = {
  subject: string;
  bodyTitle: string;
};

const COPY = {
  pending_approver: {
    subject: "[결재] 새 요청 도착",
    bodyTitle: "🔔 결재 요청 1건이 도착했습니다",
  },
  approved_author: {
    subject: "[결재] 승인 완료",
    bodyTitle: "✅ 결재가 승인되었습니다",
  },
  rejected_author: {
    subject: "[결재] 반려",
    bodyTitle: "❌ 결재가 반려되었습니다",
  },
  canceled_approver: {
    subject: "[결재] 철회",
    bodyTitle: "↩️ 결재가 철회되었습니다",
  },
} as const satisfies Record<string, CopyEntry>;

type CopyKey = keyof typeof COPY;

function buildLink(id: number): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/approvals/${id}`;
}

function renderHtml(title: string, url: string): string {
  return `<!doctype html>
<html lang="ko"><body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:540px;margin:0 auto;padding:32px 24px;background:#fff;">
    <h1 style="margin:0 0 8px 0;font-size:18px;font-weight:700;color:#1E1E1C;">${title}</h1>
    <p style="margin:0 0 24px 0;font-size:13px;color:#6B7280;">사내 전자결재 시스템</p>
    <a href="${url}" style="display:inline-block;padding:12px 28px;background:#185FA5;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">확인하기 →</a>
    <p style="margin:32px 0 0 0;color:#9CA3AF;font-size:11px;border-top:1px solid #F3F4F6;padding-top:16px;line-height:1.5;">
      이 메일은 결재 시스템에서 자동 발송됐습니다. 회신해도 처리되지 않습니다.
    </p>
  </div>
</body></html>`;
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
 * 결재 이벤트 발생 시 적절한 사용자에게 메일 알림을 보낸다.
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
    const url = buildLink(id);
    await sendMail({
      to: toEmail,
      subject: copy.subject,
      htmlBody: renderHtml(copy.bodyTitle, url),
    });
  } catch (e) {
    console.error("[notify] failed", e);
  }
}
