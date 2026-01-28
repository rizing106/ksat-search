export default function CopyrightPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Copyright</p>
          <h1 className="text-3xl font-semibold">출처 표기 원칙</h1>
          <p className="text-base text-zinc-600">
            모든 문항의 출처는 공식 공개 자료를 기준으로 표시됩니다. 문항 메타데이터와
            PDF 링크는 출처 표기를 강화하기 위한 목적으로만 활용됩니다.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">표기 방식</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-600">
            <li>기관/영역/연도 등 공개 정보 기반으로 출처를 명시합니다.</li>
            <li>PDF 링크는 공식 공개 자료로 연결합니다.</li>
            <li>원문 텍스트는 저장하지 않으며, 링크 공유만 제공합니다.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
