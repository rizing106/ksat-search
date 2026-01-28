"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PdfBboxThumbnail from "../../components/PdfBboxThumbnail";

type QuestionDetail = {
  id: string;
  public_qid: string;
  org_code2: string;
  subject_code2: string;
  year: number;
  month: number;
  number: number;
  unit: string;
  qtype: string;
  correct_rate: number | null;
  difficulty_5: string | null;
  killer_3: string | null;
  pdf_url: string;
  page_no: number;
  bbox: { x: number; y: number; w: number; h: number };
};

export default function QuestionDetailPage({
  params,
}: {
  params: { public_qid: string };
}) {
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/questions/${params.public_qid}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Request failed (${res.status})`);
        }
        const data = (await res.json()) as QuestionDetail;
        if (!cancelled) setQuestion(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "문항을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params.public_qid]);

  const correctRate =
    question?.correct_rate === null || question?.correct_rate === undefined
      ? "미집계"
      : `${question.correct_rate.toFixed(1)}%`;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.16),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(251,191,36,0.18),_transparent_45%)] text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 pb-16 pt-10 md:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Question Detail</p>
            <h1 className="mt-3 text-3xl font-semibold text-zinc-900">
              {question?.public_qid ?? params.public_qid}
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-700 transition hover:border-zinc-300"
          >
            Back to Search
          </Link>
        </header>

        {loading && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/80 p-8 text-center text-sm text-zinc-500">
            문항 정보를 불러오는 중입니다.
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && !error && question && (
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-3xl border border-zinc-200/80 bg-white/90 p-6 shadow-xl shadow-zinc-200/40">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
                    {question.org_code2}/{question.subject_code2}
                  </span>
                  <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600">
                    {question.year}년 {question.month}월 {question.number}번
                  </span>
                </div>

                <div>
                  <div className="text-lg font-semibold text-zinc-900">
                    {question.unit} · {question.qtype}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
                    <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-amber-800">
                      정답률 {correctRate}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-slate-700">
                      {question.difficulty_5 ?? "미집계"}
                    </span>
                    <span className="rounded-full border border-rose-200 bg-rose-100 px-3 py-1 text-rose-800">
                      {question.killer_3 ?? "미집계"}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 rounded-2xl border border-zinc-200/70 bg-zinc-50 p-4 text-sm text-zinc-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">PDF</span>
                    <a
                      href={question.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-zinc-900 underline decoration-dotted underline-offset-4"
                    >
                      공식 PDF 열기
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">Page</span>
                    <span>{question.page_no}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">BBox</span>
                    <span>
                      x:{question.bbox.x}, y:{question.bbox.y}, w:{question.bbox.w}, h:
                      {question.bbox.h}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex h-full flex-col gap-4">
              <PdfBboxThumbnail
                pdfUrl={question.pdf_url}
                pageNo={question.page_no}
                bbox={question.bbox}
              />
              <div className="rounded-3xl border border-zinc-200/80 bg-white/90 p-6 text-sm text-zinc-600">
                PDF 썸네일은 클라이언트 메모리에서만 생성되며 서버에 저장되지 않습니다.
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
