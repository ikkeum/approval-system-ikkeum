import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "invalid year" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("holidays")
    .select("date, name, source")
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`)
    .order("date");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holidays: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { date, name } =
    (body as { date?: unknown; name?: unknown }) ?? ({} as never);
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "date 는 YYYY-MM-DD 형식" },
      { status: 400 },
    );
  }
  if (typeof name !== "string" || !name.trim() || name.length > 100) {
    return NextResponse.json(
      { error: "name 은 1~100자 문자열" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("holidays")
    .insert({
      date,
      name: name.trim(),
      source: "manual",
      created_by: user.id,
    })
    .select("date, name, source")
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "이미 등록된 날짜입니다." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ holiday: data });
}
