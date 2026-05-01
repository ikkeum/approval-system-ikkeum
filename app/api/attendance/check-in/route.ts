import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/ip";
import { isIpAllowed, isWeekend, todayKst } from "@/lib/attendance";

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
      { error: "사내 네트워크에서만 출근 등록이 가능합니다." },
      { status: 403 },
    );
  }

  let force = false;
  try {
    const body = (await request.json()) as { force?: unknown } | null;
    if (body && body.force === true) force = true;
  } catch {
    // empty body OK
  }

  const workDate = todayKst();
  const now = new Date().toISOString();

  // 휴일/주말 검증 (force 시 우회)
  if (!force) {
    const weekend = isWeekend(workDate);
    const { data: holiday } = await supabase
      .from("holidays")
      .select("name")
      .eq("date", workDate)
      .maybeSingle();
    if (weekend || holiday) {
      const reason = holiday?.name ?? "주말";
      return NextResponse.json(
        {
          error: `오늘은 ${reason}입니다.`,
          requiresConfirm: true,
          reason,
        },
        { status: 409 },
      );
    }
  }

  const { data: existing, error: selErr } = await supabase
    .from("attendances")
    .select("*")
    .eq("user_id", user.id)
    .eq("work_date", workDate)
    .maybeSingle();
  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  if (existing?.check_in_at) {
    return NextResponse.json({ attendance: existing, alreadyCheckedIn: true });
  }

  if (existing) {
    const { data, error } = await supabase
      .from("attendances")
      .update({ check_in_at: now, check_in_ip: ip })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ attendance: data, alreadyCheckedIn: false });
  }

  const { data, error } = await supabase
    .from("attendances")
    .insert({
      user_id: user.id,
      work_date: workDate,
      check_in_at: now,
      check_in_ip: ip,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data, alreadyCheckedIn: false });
}
