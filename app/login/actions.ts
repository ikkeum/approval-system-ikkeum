"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginInput } from "@/lib/schemas";

export type LoginState = { error?: string } | null;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "이메일 또는 비밀번호 형식이 올바르지 않습니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "로그인 실패: 이메일·비밀번호를 확인해주세요." };
  }

  const next = (formData.get("next") as string) || "/dashboard";
  redirect(next);
}
