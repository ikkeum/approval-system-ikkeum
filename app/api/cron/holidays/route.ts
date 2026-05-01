import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPublicHolidays } from "@/lib/holidays";

export const runtime = "nodejs";

/**
 * 크론 트리거 동기화. Authorization: Bearer <CRON_SECRET> 으로만 호출 가능.
 * 세션이 없으므로 admin client (service role)로 RLS 를 우회한다.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET 미설정" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  const expected = `Bearer ${cronSecret}`;
  if (auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "invalid year" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const result = await syncPublicHolidays(supabase, year);
    return NextResponse.json({ year, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "sync 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
