import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";
import { enforceRateLimit } from "../../../../lib/rateLimit";

export async function GET(request: Request) {
  const rateLimitResponse = await enforceRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;
  const { data, error } = await supabase
    .from("organizations")
    .select("code2,name,kind")
    .order("code2", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
