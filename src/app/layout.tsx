import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CopyCat AI - 마케팅 콘텐츠 자동 생성",
  description:
    "URL 하나로 인스타그램 & 네이버/구글 블로그 마케팅 카피를 자동으로 생성합니다. 타겟팅된 SEO 메타 태그와 키워드까지 완벽하게 추출해 보세요.",
  keywords: ["AI 마케팅", "인스타그램 해시태그", "네이버 블로그 키워드", "SEO 최적화", "콘텐츠 자동 생성", "상세페이지 크롤링", "CopyCat AI"],
  openGraph: {
    title: "CopyCat AI - 1초 만에 끝나는 마케팅 마법",
    description: "URL 하나로 인스타그램 & 블로그 마케팅 카피를 자동으로 생성합니다.",
    url: "https://copycat-ai.test",
    siteName: "CopyCat AI",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CopyCat AI - 마케팅 콘텐츠 자동 생성",
    description: "URL 하나로 인스타그램 & 블로그 마케팅 카피를 자동 생성합니다.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard 한글 웹폰트 */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body
        className={`${inter.variable} antialiased`}
        style={{ fontFamily: "'Pretendard Variable', var(--font-inter), system-ui, sans-serif" }}
      >
        {/* 메인 앱 컨테이너 (390px 모바일 고정) */}
        <div className="max-w-[390px] mx-auto min-h-screen bg-slate-50 relative overflow-x-hidden">
          {children}
        </div>
        {/* 결제 모달 포털 (전체 화면 사용 — 390px 래퍼 바깥) */}
        <div id="portal-root" />
        {/* PortOne (아임포트) SDK — lazyOnload로 Hydration 에러 방지 */}
        <Script
          src="https://cdn.iamport.kr/v1/iamport.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
