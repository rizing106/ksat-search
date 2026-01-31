import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  context: { params: { public_qid: string } },
) {
  const _body = await request.json();
  return NextResponse.json({ ok: true });
}
