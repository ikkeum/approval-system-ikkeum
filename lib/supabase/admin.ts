import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service role 클라이언트. RLS를 우회합니다.
 * 절대 브라우저 번들에 포함되어서는 안 됩니다.
 *   - 서버 액션 / Route Handler / Server Component 내부에서만 사용
 *   - 호출 전에 반드시 호출자의 role === 'admin' 을 확인할 것
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다. .env.local 확인.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
