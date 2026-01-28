import { supabase } from "@/lib/supabaseClient";

export default async function HealthPage() {
  const { data, error } = await supabase
    .from("organizations")
    .select("code2,name,kind")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    const message = error?.message ?? "No organization found";
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 px-6 py-10">
        <h1 className="text-2xl font-semibold">Health Check</h1>
        <div className="rounded-md border p-4">
          <div className="text-sm text-gray-500">Status</div>
          <div className="mt-1 text-lg font-medium">FAIL: Supabase connection</div>
          <div className="mt-2 text-sm text-gray-600">{message}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 px-6 py-10">
      <h1 className="text-2xl font-semibold">Health Check</h1>
      <div className="rounded-md border p-4">
        <div className="text-sm text-gray-500">Status</div>
        <div className="mt-1 text-lg font-medium">OK: Supabase connected</div>
        <div className="mt-2 text-sm text-gray-600">
          {data.code2} / {data.name}
        </div>
      </div>
    </main>
  );
}
