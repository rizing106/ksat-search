import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "./lib/env.server";

function parseAdminEmails(value?: string) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function redirectLogin(
  request: NextRequest,
  response: NextResponse,
  options: { nextPath?: string; error?: string } = {},
) {
  const loginUrl = new URL("/login", request.url);
  const params: string[] = [];
  if (options.nextPath) {
    params.push(`next=${encodeURIComponent(options.nextPath)}`);
  }
  if (options.error) {
    params.push(`error=${options.error}`);
  }
  if (params.length > 0) {
    loginUrl.search = `?${params.join("&")}`;
  }
  const redirect = NextResponse.redirect(loginUrl);
  const cookies = response.cookies.getAll();
  cookies.forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => {
          response.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          response.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const adminEmails = parseAdminEmails(env.ADMIN_EMAILS ?? "");

  const userEmail = data.user?.email?.toLowerCase();
  const isAdmin = !!userEmail && adminEmails.includes(userEmail);

  if (!data.user) {
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    return redirectLogin(request, response, { nextPath });
  }

  if (!isAdmin) {
    return redirectLogin(request, response, { error: "not_admin" });
  }

  return response;
}

export const config = { matcher: ["/admin/:path*"] };
