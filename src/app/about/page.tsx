export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">About</p>
          <h1 className="text-3xl font-semibold">서비스 소개</h1>
          <p className="text-base text-zinc-600">
            수능 기출 문항을 빠르게 검색할 수 있도록 돕는 검색 서비스입니다. 키워드와 필터를
            조합해 원하는 문항을 빠르게 좁힐 수 있습니다.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">원문 미저장 정책</h2>
          <p className="mt-3 text-sm text-zinc-600">
            서비스는 원문 텍스트(지문/선지)를 저장하지 않습니다. 검색은 토큰화된 정보와 메타
            데이터만 활용하며, 원문은 서버나 DB에 보관하지 않습니다.
          </p>
        </section>
      </div>
    </div>
  );
}
