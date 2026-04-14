"use server";

import { createClient } from "@/lib/supabase/server";
import { SignupInput } from "@/lib/schemas";

export type SignupState =
  | { ok: true; email: string }
  | { ok: false; error: string }
  | null;

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = SignupInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "입력값을 확인해주세요. 비밀번호는 8자 이상이어야 합니다.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm`,
    },
  });

  if (error) {
    // DB trigger에서 도메인 거부 시 에러 메시지에 'email domain not allowed'가 포함됨
    if (/domain not allowed/i.test(error.message)) {
      return { ok: false, error: "회사 이메일 도메인이 아닙니다." };
    }
    return { ok: false, error: `회원가입 실패: ${error.message}` };
  }

  // Supabase의 identity.identity_data를 보면 identities 배열이 비어있으면 이미 가입된 이메일
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { ok: false, error: "이미 가입된 이메일입니다." };
  }

  return { ok: true, email: parsed.data.email };
}
