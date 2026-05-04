import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  const { approvalId: approvalIdStr } = await params;
  const approvalId = Number(approvalIdStr);
  if (!Number.isInteger(approvalId) || approvalId <= 0) {
    return NextResponse.json({ error: "invalid approvalId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 결재 검증 (RLS 통과: admin 은 결재 visibility 헬퍼로 보임 — 다만 admin role 은
  // approvals_select 정책이 직접 허용하지 않을 수 있어 service-role 로 조회)
  const admin = createAdminClient();
  const { data: approval, error: aprErr } = await admin
    .from("approvals")
    .select("id, type, status, author_id, payload")
    .eq("id", approvalId)
    .maybeSingle();
  if (aprErr) {
    return NextResponse.json({ error: aprErr.message }, { status: 500 });
  }
  if (!approval) {
    return NextResponse.json({ error: "approval not found" }, { status: 404 });
  }
  if (approval.type !== "attendance_correction") {
    return NextResponse.json(
      { error: "근무시각 조정 결재가 아닙니다." },
      { status: 400 },
    );
  }
  if (approval.status !== "APPROVED") {
    return NextResponse.json(
      { error: "승인된 결재만 적용할 수 있습니다." },
      { status: 400 },
    );
  }

  // 중복 적용 차단
  const { data: existing } = await admin
    .from("attendance_correction_applications")
    .select("approval_id, applied_at, applied_by")
    .eq("approval_id", approvalId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "이미 적용된 결재입니다.", appliedAt: existing.applied_at },
      { status: 409 },
    );
  }

  // payload 검증
  const payload = (approval.payload ?? {}) as {
    correction_date?: unknown;
    check_in_time?: unknown;
    check_out_time?: unknown;
  };
  const correctionDate = payload.correction_date;
  if (typeof correctionDate !== "string" || !DATE_RE.test(correctionDate)) {
    return NextResponse.json(
      { error: "payload.correction_date 가 YYYY-MM-DD 가 아닙니다." },
      { status: 400 },
    );
  }
  const inTime =
    typeof payload.check_in_time === "string" && payload.check_in_time
      ? payload.check_in_time
      : null;
  const outTime =
    typeof payload.check_out_time === "string" && payload.check_out_time
      ? payload.check_out_time
      : null;
  if (inTime && !TIME_RE.test(inTime)) {
    return NextResponse.json(
      { error: "check_in_time 은 HH:MM 형식" },
      { status: 400 },
    );
  }
  if (outTime && !TIME_RE.test(outTime)) {
    return NextResponse.json(
      { error: "check_out_time 은 HH:MM 형식" },
      { status: 400 },
    );
  }
  if (!inTime && !outTime) {
    return NextResponse.json(
      { error: "출근/퇴근 중 최소 하나는 정정 값이 필요합니다." },
      { status: 400 },
    );
  }

  // KST timestamp 조립
  const updates: { check_in_at?: string; check_out_at?: string } = {};
  if (inTime) updates.check_in_at = `${correctionDate}T${inTime}:00+09:00`;
  if (outTime) updates.check_out_at = `${correctionDate}T${outTime}:00+09:00`;

  // attendances upsert (기존 행이 있으면 부분 update, 없으면 insert)
  const { data: row } = await admin
    .from("attendances")
    .select("id")
    .eq("user_id", approval.author_id)
    .eq("work_date", correctionDate)
    .maybeSingle();

  let attendance;
  if (row) {
    const { data, error } = await admin
      .from("attendances")
      .update(updates)
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    attendance = data;
  } else {
    const { data, error } = await admin
      .from("attendances")
      .insert({
        user_id: approval.author_id,
        work_date: correctionDate,
        ...updates,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    attendance = data;
  }

  // 적용 이력 기록
  const { error: insErr } = await admin
    .from("attendance_correction_applications")
    .insert({ approval_id: approvalId, applied_by: user.id });
  if (insErr) {
    return NextResponse.json(
      {
        error: `attendances 는 갱신됐으나 이력 기록 실패: ${insErr.message}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ attendance });
}
