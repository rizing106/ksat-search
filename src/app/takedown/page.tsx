export default function TakedownPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Takedown</p>
          <h1 className="text-3xl font-semibold">삭제 요청</h1>
          <p className="text-base text-zinc-600">
            권리 침해 또는 잘못된 정보가 있을 경우 삭제 요청을 접수합니다. 요청 시 해당 문항
            토큰/메타/링크 비활성화 처리 를 진행합니다.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">제출 항목 체크리스트</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-600">
            <li>권리자 또는 대리인 정보(이름/소속/연락처)</li>
            <li>문항 식별 정보(public_qid, 기관, 연도 등)</li>
            <li>권리 침해 또는 문제 사유 설명</li>
            <li>증빙 자료(가능한 경우)</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">연락 방법</h2>
          <p className="mt-3 text-sm text-zinc-600">
            이메일: contact@example.com
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            접수 후 영업일 기준 3~5일 이내에 확인 결과를 안내합니다.
          </p>
        </section>
      </div>
    </div>
  );
}
