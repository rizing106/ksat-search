import { supabase } from "../../../../lib/supabaseClient";
import { enforceRateLimit } from "../../../../lib/rateLimit";
import { error, json } from "../../../../lib/apiResponse";

export async function GET(request: Request) {
  const rateLimitResponse = await enforceRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const { data, error: queryError } = await supabase
      .from("organizations")
      .select("code2,name,kind")
      .order("code2", { ascending: true });

    if (queryError) {
      return error(500, queryError.message, "INTERNAL_ERROR");
    }

    return json({ items: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return error(500, message, "INTERNAL_ERROR");
  }
}
