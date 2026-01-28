import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;
const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "10 s"),
    })
  : null;

function jsonResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function enforceRateLimit(request: Request): Promise<Response | null> {
  if (!ratelimit) {
    if (process.env.NODE_ENV !== "production") {
      return null;
    }
    return jsonResponse("Missing rate limit env", 500);
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0].trim();
  const key = `ip:${ip || "unknown"}`;

  const result = await ratelimit.limit(key);
  if (!result.success) {
    return jsonResponse("Too many requests", 429);
  }

  return null;
}
