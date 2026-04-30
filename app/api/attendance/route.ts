import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id") ?? user.id;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let q = supabase
    .from("attendances")
    .select("*")
    .eq("user_id", userId)
    .order("work_date", { ascending: false });
  if (from) q = q.gte("work_date", from);
  if (to) q = q.lte("work_date", to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendances: data ?? [] });
}
