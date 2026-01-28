import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ public_qid: string }> },
) {
  const { public_qid } = await params;
  const url = new URL(request.url);
  const fallbackId = url.pathname.split("/").filter(Boolean).pop();
  const publicQid = public_qid ?? fallbackId ?? "";
  if (!/^\d{12}$/.test(publicQid)) {
    return NextResponse.json({ error: "Invalid public_qid" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("public_qid", publicQid)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
