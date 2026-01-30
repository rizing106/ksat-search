import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "./lib/env";

function parseAdminEmails(value?: string) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function redirectHome(request: NextRequest, response: NextResponse) {
  const redirect = NextResponse.redirect(new URL("/", request.url));
  const cookies = response.cookies.getAll();
  cookies.forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function middleware(request: NextRequest) {
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
  const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);

  const userEmail = data.user?.email?.toLowerCase();
  const isAdmin = !!userEmail && adminEmails.includes(userEmail);

  if (!isAdmin) {
    return redirectHome(request, response);
  }

  return response;
}

export const config = { matcher: ["/admin/:path*"] };
