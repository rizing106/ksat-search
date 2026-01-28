"use client";

import { useEffect, useMemo, useState } from "react";

type BBox = { x: number; y: number; w: number; h: number };

type Props = {
  pdfUrl: string;
  pageNo: number;
  bbox: BBox;
  maxWidth?: number;
};

type Status = "idle" | "loading" | "ready" | "error";

export default function PdfBboxThumbnail({
  pdfUrl,
  pageNo,
  bbox,
  maxWidth = 320,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const bboxKey = useMemo(
    () => `${bbox.x}-${bbox.y}-${bbox.w}-${bbox.h}-${pageNo}-${pdfUrl}`,
    [bbox.x, bbox.y, bbox.w, bbox.h, pageNo, pdfUrl],
  );

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setStatus("loading");
      setError(null);
      setImageUrl(null);

      try {
        const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const loadingTask = pdfjs.getDocument({ url: pdfUrl });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNo);

        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.8, maxWidth / viewport.width);
        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas not supported");

        canvas.width = Math.floor(scaledViewport.width);
        canvas.height = Math.floor(scaledViewport.height);

        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;

        const cropX = Math.max(0, Math.floor(bbox.x * canvas.width));
        const cropY = Math.max(0, Math.floor(bbox.y * canvas.height));
        const cropW = Math.max(1, Math.floor(bbox.w * canvas.width));
        const cropH = Math.max(1, Math.floor(bbox.h * canvas.height));

        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropContext = cropCanvas.getContext("2d");
        if (!cropContext) throw new Error("Canvas not supported");

        cropContext.drawImage(
          canvas,
          cropX,
          cropY,
          cropW,
          cropH,
          0,
          0,
          cropW,
          cropH,
        );

        const dataUrl = cropCanvas.toDataURL("image/png");
        if (!cancelled) {
          setImageUrl(dataUrl);
          setStatus("ready");
        }
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to render thumbnail.");
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [bboxKey, maxWidth, pdfUrl, pageNo]);

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white/80 p-8 text-center text-sm text-zinc-500">
        PDF 썸네일 로딩 중
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700">
        {error ?? "썸네일을 불러오지 못했습니다."}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="문항 썸네일"
          className="max-h-[420px] w-full rounded-2xl border border-zinc-200 object-contain"
        />
      ) : (
        <div className="text-sm text-zinc-500">썸네일 준비 중</div>
      )}
    </div>
  );
}
