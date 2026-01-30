export default function AdminHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Admin Home</h1>
      <p className="text-sm text-gray-600">관리자 전용 영역입니다.</p>
      <a className="text-blue-600 hover:underline" href="/admin/bbox">
        /admin/bbox
      </a>
    </main>
  );
}
