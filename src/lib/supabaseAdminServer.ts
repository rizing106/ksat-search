import { createClient } from "@supabase/supabase-js";
import { getServerEnv, requireServiceRoleKey } from "./env.server";

let cachedAdmin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (cachedAdmin) return cachedAdmin;
  const env = getServerEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL for supabaseAdmin.");
  }
  const serviceRoleKey = requireServiceRoleKey();
  cachedAdmin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cachedAdmin;
}
