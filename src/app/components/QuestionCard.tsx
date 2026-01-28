import Link from "next/link";
import type { Tables } from "../../types/db";

type QuestionRow = Tables["questions"]["Row"];

type Props = {
  question: QuestionRow;
};

export default function QuestionCard({ question }: Props) {
  const difficultyLabel = question.difficulty_5 ?? "미집계";
  const killerLabel = question.killer_3 ?? "미집계";
  const correctRate =
    question.correct_rate === null ? "미집계" : `${question.correct_rate.toFixed(1)}%`;

  return (
    <Link
      href={`/q/${question.public_qid}`}
      className="group flex h-full flex-col justify-between gap-5 rounded-3xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm transition hover:-translate-y-1 hover:border-zinc-300 hover:shadow-lg"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold text-zinc-500">{question.public_qid}</div>
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
            {question.org_code2}/{question.subject_code2}
          </span>
        </div>
        <div className="text-lg font-semibold text-zinc-900">
          {question.year}년 {question.month}월 {question.number}번
        </div>
        <div className="text-sm text-zinc-500">
          {question.unit} · {question.qtype}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="amber">정답률 {correctRate}</Badge>
        <Badge tone="slate">{difficultyLabel}</Badge>
        <Badge tone="rose">{killerLabel}</Badge>
      </div>
    </Link>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "amber" | "slate" | "rose";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : tone === "rose"
        ? "bg-rose-100 text-rose-800 border-rose-200"
        : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${toneClass}`}
    >
      {children}
    </span>
  );
}
