"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type RowPreview = { code2: string; name: string };

type Status = {
  ok: boolean;
  label: string;
  row?: RowPreview | null;
  error?: string | null;
};

export default function RlsHealthPage() {
  const [orgStatus, setOrgStatus] = useState<Status>({
    ok: false,
    label: "organizations",
    row: null,
    error: null,
  });
  const [subjectStatus, setSubjectStatus] = useState<Status>({
    ok: false,
    label: "subjects",
    row: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("code2,name")
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setOrgStatus({
          ok: !orgError,
          label: "organizations",
          row: orgData ?? null,
          error: orgError?.message ?? null,
        });
      }

      const { data: subjectData, error: subjectError } = await supabase
        .from("subjects")
        .select("code2,name")
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setSubjectStatus({
          ok: !subjectError,
          label: "subjects",
          row: subjectData ?? null,
          error: subjectError?.message ?? null,
        });
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Health</p>
          <h1 className="text-2xl font-semibold">RLS 확인</h1>
          <p className="text-sm text-zinc-600">
            익명 사용자 기준으로 organizations/subjects 조회 결과를 확인합니다.
          </p>
        </header>

        <StatusCard status={orgStatus} />
        <StatusCard status={subjectStatus} />
      </div>
    </div>
  );
}

function StatusCard({ status }: { status: Status }) {
  const badge = status.ok ? "RLS OK" : "RLS BLOCKED";
  const tone = status.ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-700">{status.label}</div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
          {badge}
        </span>
      </div>
      {status.ok ? (
        <div className="mt-4 text-sm text-zinc-600">
          {status.row ? (
            <span>
              code2: <strong className="text-zinc-900">{status.row.code2}</strong> · name:{" "}
              <strong className="text-zinc-900">{status.row.name}</strong>
            </span>
          ) : (
            "조회 성공 (데이터 없음)"
          )}
        </div>
      ) : (
        <div className="mt-4 text-sm text-rose-700">
          {status.error ?? "조회 실패"}
        </div>
      )}
    </div>
  );
}
