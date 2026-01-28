import { env } from "@/lib/env";

const fallbackBaseUrl = "https://ksat-search.vercel.app";

export async function GET() {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL ?? fallbackBaseUrl;
  const body = [
    "User-agent: *",
    "Disallow: /api/",
    "Allow: /",
    `Sitemap: ${baseUrl}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "content-type": "text/plain" },
  });
}
