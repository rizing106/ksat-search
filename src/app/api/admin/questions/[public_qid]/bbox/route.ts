import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env.server";
import { supabaseAdmin } from "@/lib/supabaseAdminServer";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { json } from "@/lib/apiResponse";

export const runtime = "nodejs";

type Params = { public_qid: string };
type BBox = { x: number; y: number; w: number; h: number };

function parseAdminEmails(raw?: string) {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

async function getUserEmail(req: NextRequest): Promise<string | null> {
  // 1) Cookie-based session (browser login)
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email?.toLowerCase();
    if (email) return email;
  } catch {
    // ignore and try bearer
  }

  // 2) Authorization: Bearer <access_token> (PowerShell testing)
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  const token = m[1];
  try {
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data } = await supabase.auth.getUser(token);
    return data.user?.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest) {
  return json(
    { error: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { Allow: "PATCH" } },
  );
}

export async function PATCH(req: NextRequest, context: { params: Promise<Params> }) {
  const { public_qid } = await context.params;

  // --- auth/admin check ---
  const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);
  if (adminEmails.length === 0) {
    return json({ error: "Admin list not configured", code: "FORBIDDEN" }, { status: 403 });
  }

  const userEmail = await getUserEmail(req);
  if (!userEmail) {
    return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!adminEmails.includes(userEmail)) {
    return json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  // --- input validation ---
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON", code: "BAD_REQUEST" }, { status: 400 });
  }

  const page_no = body?.page_no;
  const bbox: BBox | undefined = body?.bbox;

  if (!Number.isInteger(page_no) || page_no < 1) {
    return json({ error: "Invalid page_no", code: "BAD_REQUEST" }, { status: 400 });
  }
  if (
    !bbox ||
    !isFiniteNumber(bbox.x) || bbox.x < 0 ||
    !isFiniteNumber(bbox.y) || bbox.y < 0 ||
    !isFiniteNumber(bbox.w) || bbox.w <= 0 ||
    !isFiniteNumber(bbox.h) || bbox.h <= 0
  ) {
    return json({ error: "Invalid bbox", code: "BAD_REQUEST" }, { status: 400 });
  }

  // --- DB update (service_role) ---
  const { data, error } = await supabaseAdmin
    .from("questions")
    .update({
      page_no,
      bbox_x: bbox.x,
      bbox_y: bbox.y,
      bbox_w: bbox.w,
      bbox_h: bbox.h,
    })
    .eq("public_qid", public_qid)
    .select("public_qid");

  if (error) {
    return json({ error: "DB update failed", code: "DB_ERROR" }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  return json({ ok: true }, { status: 200 });
}
