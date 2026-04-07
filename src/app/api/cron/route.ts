import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * 🕐 Vercel Cron Job - DB Keep-Alive
 *
 * 매일 한국 시간 오전 9시(UTC 0시)에 Vercel이 자동 호출합니다.
 * Supabase DB에 간단한 쿼리를 보내 연결을 유지합니다.
 *
 * 보안: CRON_SECRET 헤더 검증 포함
 */
export async function GET(request: NextRequest) {
  // 🔒 보안: Vercel Cron이 보내는 CRON_SECRET 검증
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ✅ DB 찌르기: 간단한 쿼리로 연결 유지
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .limit(1);

    if (error) {
      console.error("❌ Cron DB ping failed:", error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Cron ping success at ${new Date().toISOString()}`);

    return NextResponse.json({
      success: true,
      message: "DB keep-alive ping successful",
      timestamp: new Date().toISOString(),
      rowsFound: data?.length ?? 0,
    });
  } catch (err) {
    console.error("❌ Cron unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
