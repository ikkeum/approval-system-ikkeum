import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateStamp } from "@/lib/stamp";

// sign-generator는 Node.js 런타임 필요 (fs / 폰트 파일 접근)
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "1";

  const { data: profile, error: selErr } = await supabase
    .from("profiles")
    .select("name, stamp_svg")
    .eq("id", user.id)
    .single();
  if (selErr || !profile) {
    return NextResponse.json({ error: "profile not found" }, { status: 404 });
  }

  if (profile.stamp_svg && !force) {
    return NextResponse.json({ svg: profile.stamp_svg, regenerated: false });
  }

  let svg: string;
  try {
    svg = await generateStamp(profile.name);
  } catch (e) {
    const message = e instanceof Error ? e.message : "stamp generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { error: updErr } = await supabase
    .from("profiles")
    .update({ stamp_svg: svg })
    .eq("id", user.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ svg, regenerated: true });
}
