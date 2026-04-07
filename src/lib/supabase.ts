import { createClient } from "@supabase/supabase-js";

// 🔑 서버 전용 Supabase 클라이언트 (Service Role Key 사용)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🌐 클라이언트용 Supabase 클라이언트 (Anon Key 사용)
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
