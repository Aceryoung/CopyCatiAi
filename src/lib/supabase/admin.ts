import { createClient } from "@supabase/supabase-js";

// 🔑 서버 전용 Supabase 클라이언트 (Service Role Key 사용, Admin 권한)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
