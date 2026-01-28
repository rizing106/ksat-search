import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { error } from "./apiResponse";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;
const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "10 s"),
    })
  : null;

export async function enforceRateLimit(request: Request): Promise<Response | null> {
  if (!ratelimit) {
    if (process.env.NODE_ENV !== "production") {
      return null;
    }
    return error(500, "Missing rate limit env", "INTERNAL_ERROR");
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0].trim();
  const key = `ip:${ip || "unknown"}`;

  const result = await ratelimit.limit(key);
  if (!result.success) {
    return error(429, "Too many requests", "RATE_LIMITED");
  }

  return null;
}
