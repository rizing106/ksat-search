import { env } from "@/lib/env";

const fallbackBaseUrl = "https://ksat-search.vercel.app";

export async function GET() {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL ?? fallbackBaseUrl;
  const urls = [
    `${baseUrl}/`,
    `${baseUrl}/about`,
    `${baseUrl}/copyright`,
    `${baseUrl}/takedown`,
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { "content-type": "application/xml" },
  });
}
