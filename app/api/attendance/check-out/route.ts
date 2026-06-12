import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/ip";
import { isIpAllowed, todayKst, yesterdayKst } from "@/lib/attendance";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  if (!isIpAllowed(ip)) {
    return NextResponse.json(
      { error: "사내 네트워크에서만 퇴근 등록이 가능합니다." },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();
  const todayDate = todayKst();
  const yesterdayDate = yesterdayKst();

  // RLS 가 attendances 직접 쓰기를 차단하므로(근태 위조 방지),
  // IP 검증을 통과한 이 라우트만 service_role 로 기록한다. user_id 는 세션 값만 사용.
  const admin = createAdminClient();

  // 1) 오늘 행 우선
  const { data: today, error: selErr } = await admin
    .from("attendances")
    .select("*")
    .eq("user_id", user.id)
    .eq("work_date", todayDate)
    .maybeSingle();
  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  let target = today?.check_in_at ? today : null;

  // 2) 자정 넘어 퇴근: 어제 행이 미퇴근이면 폴백
  if (!target) {
    const { data: yesterday } = await admin
      .from("attendances")
      .select("*")
      .eq("user_id", user.id)
      .eq("work_date", yesterdayDate)
      .maybeSingle();
    if (yesterday?.check_in_at && !yesterday.check_out_at) {
      target = yesterday;
    }
  }

  if (!target) {
    return NextResponse.json(
      { error: "오늘 출근 기록이 없습니다." },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from("attendances")
    .update({ check_out_at: now, check_out_ip: ip })
    .eq("id", target.id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data });
}
