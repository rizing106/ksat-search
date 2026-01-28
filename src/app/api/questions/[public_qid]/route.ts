import type { NextRequest } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";
import { enforceRateLimit } from "../../../../lib/rateLimit";
import { error, json } from "../../../../lib/apiResponse";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ public_qid: string }> },
) {
  const rateLimitResponse = await enforceRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const { public_qid } = await params;
    const url = new URL(request.url);
    const fallbackId = url.pathname.split("/").filter(Boolean).pop();
    const publicQid = public_qid ?? fallbackId ?? "";
    if (!/^\d{12}$/.test(publicQid)) {
      return error(400, "Invalid public_qid", "BAD_REQUEST");
    }

    const { data, error: queryError } = await supabase
      .from("questions")
      .select("*")
      .eq("public_qid", publicQid)
      .maybeSingle();

    if (queryError) {
      return error(500, queryError.message, "INTERNAL_ERROR");
    }

    if (!data) {
      return error(404, "Not found", "NOT_FOUND");
    }

    return json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return error(500, message, "INTERNAL_ERROR");
  }
}
