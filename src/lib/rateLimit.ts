import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { error } from "./apiResponse";

const DEFAULT_WINDOW_SEC = 10;
const DEFAULT_MAX = 30;
const DEFAULT_ADMIN_WINDOW_SEC = 10;
const DEFAULT_ADMIN_MAX = 10;

function parseEnvInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    console.warn(`[rateLimit] Invalid ${name}=${raw}; using ${fallback}`);
    return fallback;
  }
  return parsed;
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;
const windowSec = parseEnvInt("RATE_LIMIT_WINDOW_SEC", DEFAULT_WINDOW_SEC);
const maxRequests = parseEnvInt("RATE_LIMIT_MAX", DEFAULT_MAX);
const adminWindowSec = parseEnvInt("ADMIN_RATE_LIMIT_WINDOW_SEC", DEFAULT_ADMIN_WINDOW_SEC);
const adminMaxRequests = parseEnvInt("ADMIN_RATE_LIMIT_MAX", DEFAULT_ADMIN_MAX);

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSec} s`),
    })
  : null;

const adminRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(adminMaxRequests, `${adminWindowSec} s`),
    })
  : null;

export async function enforceRateLimit(request: Request): Promise<Response | null> {
  if (!ratelimit || !adminRatelimit) {
    if (process.env.NODE_ENV !== "production") {
      return null;
    }
    return error(500, "Missing rate limit env", "INTERNAL_ERROR");
  }

  const url = new URL(request.url);
  const isAdminPath = url.pathname.startsWith("/api/admin/");
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0].trim();
  const key = `ip:${ip || "unknown"}`;

  const limiter = isAdminPath ? adminRatelimit : ratelimit;
  const result = await limiter.limit(key);
  if (!result.success) {
    return error(429, "Too many requests", "RATE_LIMITED");
  }

  return null;
}
