"use client";

import { useState } from "react";
import PdfBboxThumbnail from "@/app/components/PdfBboxThumbnail";

type QuestionDetail = {
  public_qid: string;
  pdf_url: string;
  page_no: number;
  bbox: { x: number; y: number; w: number; h: number };
};

type ApiError = { error: string; code?: string };

export default function AdminBboxPage() {
  const [publicQid, setPublicQid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [data, setData] = useState<QuestionDetail | null>(null);

  const handleLoad = async () => {
    const trimmed = publicQid.trim();
    if (!/^\d{12}$/.test(trimmed)) {
      setError({ error: "public_qid는 12자리 숫자여야 합니다.", code: "BAD_REQUEST" });
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(`/api/questions/${trimmed}`);
      const payload = (await res.json()) as QuestionDetail | ApiError;
      if (!res.ok) {
        setError(payload as ApiError);
        return;
      }
      setData(payload as QuestionDetail);
    } catch (err) {
      setError({
        error: err instanceof Error ? err.message : "Unknown error",
        code: "INTERNAL_ERROR",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Admin BBox Tool (scaffold)</h1>
        <p className="text-sm text-gray-600">
          TODO: drag to set bbox + save (저장 기능은 다음 단계)
        </p>
      </header>

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="010220261122 같은 12자리"
            value={publicQid}
            onChange={(event) => setPublicQid(event.target.value)}
          />
          <button
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-400"
            disabled={loading}
            onClick={handleLoad}
          >
            {loading ? "불러오는 중..." : "불러오기"}
          </button>
          <button
            className="rounded-md border px-4 py-2 text-sm font-medium text-gray-500"
            disabled
          >
            bbox 저장
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">TODO: drag to set bbox + save</p>

        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error.error}
            {error.code ? ` (${error.code})` : ""}
          </div>
        )}
      </section>

      {data && (
        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">문항 메타</h2>
            <dl className="text-sm text-gray-700">
              <div className="mb-2">
                <dt className="text-xs text-gray-500">public_qid</dt>
                <dd className="font-medium">{data.public_qid}</dd>
              </div>
              <div className="mb-2">
                <dt className="text-xs text-gray-500">pdf_url</dt>
                <dd>
                  <a
                    className="break-all text-blue-600 hover:underline"
                    href={data.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {data.pdf_url}
                  </a>
                </dd>
              </div>
              <div className="mb-2">
                <dt className="text-xs text-gray-500">page_no</dt>
                <dd>{data.page_no}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">bbox (x, y, w, h)</dt>
                <dd>
                  {data.bbox.x}, {data.bbox.y}, {data.bbox.w}, {data.bbox.h}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">미리보기</h2>
            <PdfBboxThumbnail
              pdfUrl={data.pdf_url}
              pageNo={data.page_no}
              bbox={data.bbox}
              maxWidth={520}
            />
          </div>
        </section>
      )}
    </main>
  );
}
