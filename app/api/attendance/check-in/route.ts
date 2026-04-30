import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/ip";
import { isIpAllowed, todayKst } from "@/lib/attendance";

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

  const workDate = todayKst();
  const now = new Date().toISOString();

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
