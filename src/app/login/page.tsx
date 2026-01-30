import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type LoginPageProps = {
  searchParams?: { error?: string };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  async function loginAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      redirect("/login?error=1");
    }

    redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Admin Login</h1>
      <p className="text-sm text-gray-600">관리자 계정으로 로그인하세요.</p>

      {searchParams?.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.
        </div>
      ) : null}

      <form action={loginAction} className="flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-sm">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-gray-600">Email</span>
          <input
            type="email"
            name="email"
            required
            className="rounded-md border px-3 py-2 focus:border-blue-500 focus:outline-none"
            placeholder="admin@example.com"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-gray-600">Password</span>
          <input
            type="password"
            name="password"
            required
            className="rounded-md border px-3 py-2 focus:border-blue-500 focus:outline-none"
            placeholder="••••••••"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          로그인
        </button>
      </form>
    </main>
  );
}
