import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncPublicHolidays } from "@/lib/holidays";

export const runtime = "nodejs";

/**
 * 관리자 트리거 동기화. 세션 기반 인증 + role='admin' 검증.
 * cron 기반 동기화는 /api/cron/holidays 사용.
 */
export async function POST(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "invalid year" }, { status: 400 });
  }

  try {
    const result = await syncPublicHolidays(supabase, year);
    return NextResponse.json({ year, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "sync 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
