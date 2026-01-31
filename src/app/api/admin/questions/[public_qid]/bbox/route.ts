import { NextRequest, NextResponse } from "next/server";

type Params = { public_qid: string };

export async function GET(_req: NextRequest) {
  return new NextResponse(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: { "content-type": "application/json", Allow: "PATCH" },
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
  const { public_qid } = await context.params;

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {}

  return NextResponse.json({ ok: true, public_qid, received: payload !== null });
}
