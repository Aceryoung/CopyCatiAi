import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // AI 학습 및 수집 크롤러 차단
        userAgent: ['GPTBot', 'Google-Extended', 'Bytespider', 'ClaudeBot', 'CCBot'],
        disallow: ['/'],
      },
      {
        // 일반 검색 엔진 및 사용자 에이전트 허용
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: 'https://copycat-ai.com/sitemap.xml',
  };
}
