"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요" };
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") return { error: "admin 전용 기능입니다." };
  return { userId: user.id };
}

const RoleEnum = z.enum(["member", "manager", "admin"]);

const DateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal(""));

const InviteInput = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(40),
  dept: z.string().max(40).optional(),
  role: RoleEnum.default("member"),
  manager_id: z.string().uuid().optional().or(z.literal("")),
  hire_date: DateStr,
  team_id: z.string().uuid().optional().or(z.literal("")),
});

export type InviteState =
  | { ok: true; email: string }
  | { ok: false; error: string }
  | null;

export async function inviteMemberAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const auth = await assertAdmin();
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = InviteInput.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    dept: formData.get("dept") || undefined,
    role: formData.get("role") || "member",
    manager_id: formData.get("manager_id") || "",
    hire_date: formData.get("hire_date") || "",
    team_id: formData.get("team_id") || "",
  });
  if (!parsed.success) {
    return { ok: false, error: "입력값을 확인해주세요." };
  }

  const { email, name, dept, role } = parsed.data;
  const manager_id = parsed.data.manager_id || null;
  const hire_date = parsed.data.hire_date || null;
  const team_id = parsed.data.team_id || null;

  const admin = createAdminClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      name,
      dept: dept ?? null,
      role,
      manager_id,
      hire_date,
      team_id,
    },
    redirectTo: `${siteUrl}/auth/confirm?next=/dashboard`,
  });

  if (error) {
    // 도메인 거부 메시지 친절화
    if (/domain not allowed/i.test(error.message)) {
      return { ok: false, error: "회사 이메일 도메인이 아닙니다." };
    }
    if (/already.*registered|already exists/i.test(error.message)) {
      return { ok: false, error: "이미 가입된 이메일입니다." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/members");
  return { ok: true, email };
}

const UpdateInput = z.object({
  id: z.string().uuid(),
  dept: z.string().max(40).optional().or(z.literal("")),
  role: RoleEnum,
  manager_id: z.string().uuid().optional().or(z.literal("")),
  hire_date: DateStr,
  team_id: z.string().uuid().optional().or(z.literal("")),
  is_executive: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export async function updateMemberAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const auth = await assertAdmin();
  if ("error" in auth) return { error: auth.error };

  const parsed = UpdateInput.safeParse({
    id: formData.get("id"),
    dept: formData.get("dept") || "",
    role: formData.get("role"),
    manager_id: formData.get("manager_id") || "",
    hire_date: formData.get("hire_date") || "",
    team_id: formData.get("team_id") || "",
    is_executive: formData.get("is_executive") || "",
  });
  if (!parsed.success) return { error: "입력값을 확인해주세요." };

  const admin = createAdminClient();

  // 대표는 1명만. 켜는 쪽이면 먼저 다른 사람 off 처리 (앱 레벨 제약).
  if (parsed.data.is_executive) {
    await admin
      .from("profiles")
      .update({ is_executive: false })
      .neq("id", parsed.data.id)
      .eq("is_executive", true);
  }

  const { error } = await admin
    .from("profiles")
    .update({
      dept: parsed.data.dept || null,
      role: parsed.data.role,
      manager_id: parsed.data.manager_id || null,
      hire_date: parsed.data.hire_date || null,
      team_id: parsed.data.team_id || null,
      is_executive: parsed.data.is_executive,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };
  revalidatePath("/admin/members");
  return {};
}

export async function resendInviteAction(
  email: string,
): Promise<{ error?: string }> {
  const auth = await assertAdmin();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // 기존 초대가 만료된 경우 대비: 새 magic link 생성 + 이메일 발송
  const { error } = await admin.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/confirm?next=/dashboard` },
  });
  if (error) return { error: error.message };
  return {};
}
