import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("attendance_settings")
    .select("late_threshold")
    .eq("id", 1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    lateThreshold: data?.late_threshold ?? "09:00:00",
  });
}

export async function PUT(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const lateThreshold =
    body && typeof body === "object" && "lateThreshold" in body
      ? (body as { lateThreshold: unknown }).lateThreshold
      : null;
  if (typeof lateThreshold !== "string" || !TIME_RE.test(lateThreshold)) {
    return NextResponse.json(
      { error: "lateThreshold 는 HH:MM 또는 HH:MM:SS 형식" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("attendance_settings")
    .update({ late_threshold: lateThreshold, updated_by: user.id })
    .eq("id", 1)
    .select("late_threshold")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lateThreshold: data.late_threshold });
}
