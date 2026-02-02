"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QuestionCard from "./QuestionCard";
import type { Tables } from "../../types/db";

type QuestionRow = Tables["questions"]["Row"];

type SearchState = {
  q: string;
  org: string;
  subject: string;
  year: string;
  month: string;
  number: string;
  unit: string;
  qtype: string;
  difficulty_5: string;
  killer_3: string;
  page: number;
  pageSize: number;
};

type MetaItem = { code2: string; name: string; kind?: string };

const DEFAULT_STATE: SearchState = {
  q: "",
  org: "",
  subject: "",
  year: "",
  month: "",
  number: "",
  unit: "",
  qtype: "",
  difficulty_5: "",
  killer_3: "",
  page: 1,
  pageSize: 20,
};

export default function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<SearchState>(DEFAULT_STATE);
  const [items, setItems] = useState<QuestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [orgOptions, setOrgOptions] = useState<MetaItem[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<MetaItem[]>([]);

  useEffect(() => {
    const next: SearchState = {
      q: searchParams.get("q") ?? "",
      org: searchParams.get("org") ?? "",
      subject: searchParams.get("subject") ?? "",
      year: searchParams.get("year") ?? "",
      month: searchParams.get("month") ?? "",
      number: searchParams.get("number") ?? "",
      unit: searchParams.get("unit") ?? "",
      qtype: searchParams.get("qtype") ?? "",
      difficulty_5: searchParams.get("difficulty_5") ?? "",
      killer_3: searchParams.get("killer_3") ?? "",
      page: Number(searchParams.get("page") ?? DEFAULT_STATE.page),
      pageSize: Number(searchParams.get("pageSize") ?? DEFAULT_STATE.pageSize),
    };

    if (!Number.isFinite(next.page) || next.page < 1) next.page = DEFAULT_STATE.page;
    if (!Number.isFinite(next.pageSize) || next.pageSize < 1) {
      next.pageSize = DEFAULT_STATE.pageSize;
    }

    setState(next);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const [orgRes, subjectRes] = await Promise.all([
          fetch("/api/meta/organizations"),
          fetch("/api/meta/subjects"),
        ]);

        if (!orgRes.ok || !subjectRes.ok) {
          throw new Error("?„í„° ëª©ë¡ ë¡œë”© ?¤íŒ¨");
        }

        const orgJson = await orgRes.json();
        const subjectJson = await subjectRes.json();

        if (!cancelled) {
          setOrgOptions(orgJson.items ?? []);
          setSubjectOptions(subjectJson.items ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setMetaError(err instanceof Error ? err.message : "?„í„° ëª©ë¡ ë¡œë”© ?¤íŒ¨");
          setOrgOptions([]);
          setSubjectOptions([]);
        }
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  const apiQuery = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.get("page")) params.set("page", String(DEFAULT_STATE.page));
    if (!params.get("pageSize")) params.set("pageSize", String(DEFAULT_STATE.pageSize));
    return params.toString();
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function fetchQuestions() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/questions?${apiQuery}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Request failed (${res.status})`);
        }
        const data = await res.json();
        if (cancelled) return;
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "ê²€?‰ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.");
        setItems([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchQuestions();
    return () => {
      cancelled = true;
    };
  }, [apiQuery]);

  function updateField<T extends keyof SearchState>(field: T, value: SearchState[T]) {
    setState((prev) => ({ ...prev, [field]: value }));
  }

  function buildParams(nextState: SearchState) {
    const params = new URLSearchParams();
    if (nextState.q) params.set("q", nextState.q);
    if (nextState.org) params.set("org", nextState.org);
    if (nextState.subject) params.set("subject", nextState.subject);
    if (nextState.year) params.set("year", nextState.year);
    if (nextState.month) params.set("month", nextState.month);
    if (nextState.number) params.set("number", nextState.number);
    if (nextState.unit) params.set("unit", nextState.unit);
    if (nextState.qtype) params.set("qtype", nextState.qtype);
    if (nextState.difficulty_5) params.set("difficulty_5", nextState.difficulty_5);
    if (nextState.killer_3) params.set("killer_3", nextState.killer_3);
    params.set("page", String(nextState.page));
    params.set("pageSize", String(nextState.pageSize));
    return params;
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nextState = { ...state, page: 1 };
    const params = buildParams(nextState);
    router.push(`/?${params.toString()}`);
  }

  function handlePageChange(nextPage: number) {
    const params = buildParams({ ...state, page: nextPage });
    router.push(`/?${params.toString()}`);
  }

  function handleResetFilters() {
    setState(DEFAULT_STATE);
    router.push("/");
  }

  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.16),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(251,191,36,0.18),_transparent_45%)] text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 pb-16 pt-12 md:px-10">
        <header className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-zinc-500">KSAT SEARCH</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-zinc-900 md:text-5xl">
                ë¹ ë¥´ê²?ì°¾ëŠ” ?˜ëŠ¥ ê¸°ì¶œ
              </h1>
              <p className="mt-3 max-w-2xl text-base text-zinc-600">
                ?¤ì›Œ?œì? ?„í„°ë¥?ì¡°í•©??ë¬¸í•­??ë¹ ë¥´ê²?ì¢í?ë³´ì„¸?? ê²°ê³¼???¤ì‹œê°„ìœ¼ë¡?URL??                ë°˜ì˜?©ë‹ˆ??
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200/70 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
              <div className="text-xs text-zinc-500">?„ì¬ ê²°ê³¼</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-900">{total}</div>
            </div>
          </div>
        </header>

        <form
          onSubmit={handleSearch}
          className="rounded-3xl border border-zinc-200/70 bg-white/90 p-6 shadow-xl shadow-zinc-200/40 backdrop-blur"
        >
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                Search
              </label>
              <input
                value={state.q}
                onChange={(e) => updateField("q", e.target.value)}
                placeholder="?¤ì›Œ???ëŠ” ?˜ì‹ ?ŒíŠ¸"
                className="mt-3 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="h-12 rounded-2xl bg-zinc-900 px-6 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-zinc-800"
              >
                ê²€??              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {metaLoading && (
              <div className="md:col-span-3 rounded-2xl border border-dashed border-zinc-300 bg-white/80 p-4 text-center text-sm text-zinc-500">
                ë¶ˆëŸ¬?¤ëŠ” ì¤?..
              </div>
            )}
            {metaError && (
              <div className="md:col-span-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-700">
                ?„í„° ëª©ë¡ ë¡œë”© ?¤íŒ¨ Â· ?ˆë¡œê³ ì¹¨ ?´ì£¼?¸ìš”
              </div>
            )}
            <FilterInput
              label="ê¸°ê?"
              value={state.org}
              onChange={(value) => updateField("org", value)}
              placeholder="?? MO"
            />
            <FilterInput
              label="?ì—­"
              value={state.subject}
              onChange={(value) => updateField("subject", value)}
              placeholder="?? MA"
            />
            <FilterInput
              label="?°ë„"
              value={state.year}
              onChange={(value) => updateField("year", value)}
              placeholder="2024"
            />
            <FilterInput
              label="??
              value={state.month}
              onChange={(value) => updateField("month", value)}
              placeholder="11"
            />
            <FilterInput
              label="ë¬¸í•­ë²ˆí˜¸"
              value={state.number}
              onChange={(value) => updateField("number", value)}
              placeholder="1"
            />
            <FilterInput
              label="?¨ì›"
              value={state.unit}
              onChange={(value) => updateField("unit", value)}
              placeholder="?˜ì—´"
            />
            <FilterInput
              label="? í˜•"
              value={state.qtype}
              onChange={(value) => updateField("qtype", value)}
              placeholder="ê°ê???
            />
            <FilterSelect
              label="ê¸°ê?(ì½”ë“œ)"
              value={state.org}
              onChange={(value) => updateField("org", value)}
              options={[
                { value: "", label: "?„ì²´" },
                ...orgOptions.map((org) => ({
                  value: org.code2,
                  label: `${org.code2} Â· ${org.name}`,
                })),
              ]}
            />
            <FilterSelect
              label="?ì—­(ì½”ë“œ)"
              value={state.subject}
              onChange={(value) => updateField("subject", value)}
              options={[
                { value: "", label: "?„ì²´" },
                ...subjectOptions.map((subject) => ({
                  value: subject.code2,
                  label: `${subject.code2} Â· ${subject.name}`,
                })),
              ]}
            />
            <FilterSelect
              label="?œì´??5)"
              value={state.difficulty_5}
              onChange={(value) => updateField("difficulty_5", value)}
              options={[
                { value: "", label: "?„ì²´" },
                { value: "ë§¤ìš° ?¬ì?", label: "ë§¤ìš° ?¬ì?" },
                { value: "?¬ì?", label: "?¬ì?" },
                { value: "ë³´í†µ", label: "ë³´í†µ" },
                { value: "?´ë ¤?€(ì¤€?¬ëŸ¬)", label: "?´ë ¤?€(ì¤€?¬ëŸ¬)" },
                { value: "ë§¤ìš° ?´ë ¤?€(?¬ëŸ¬)", label: "ë§¤ìš° ?´ë ¤?€(?¬ëŸ¬)" },
              ]}
            />
            <FilterSelect
              label="?¬ëŸ¬(3)"
              value={state.killer_3}
              onChange={(value) => updateField("killer_3", value)}
              options={[
                { value: "", label: "?„ì²´" },
                { value: "ë¹„í‚¬??, label: "ë¹„í‚¬?? },
                { value: "ì¤€?¬ëŸ¬", label: "ì¤€?¬ëŸ¬" },
                { value: "?¬ëŸ¬", label: "?¬ëŸ¬" },
              ]}
            />
            <FilterInput
              label="?˜ì´ì§€ ?¬ê¸°"
              value={String(state.pageSize)}
              onChange={(value) => {
                const num = Number(value);
                if (!Number.isNaN(num)) updateField("pageSize", num);
              }}
              placeholder="20"
            />
          </div>
        </form>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-zinc-500">
              ?˜ì´ì§€ {state.page} / {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(1, state.page - 1))}
                disabled={state.page <= 1}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ?´ì „
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(Math.min(totalPages, state.page + 1))}
                disabled={state.page >= totalPages}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ?¤ìŒ
              </button>
            </div>
          </div>

          {loading && (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/80 p-6 text-center text-sm text-zinc-500">
              ë¬¸í•­??ë¶ˆëŸ¬?¤ëŠ” ì¤‘ì…?ˆë‹¤.
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/80 p-6 text-center text-sm text-zinc-600">
              <div className="text-base font-semibold text-zinc-800">
                ÇöÀç µ¥ÀÌÅÍ°¡ ¾ÆÁ÷ Àû¾î¼­ °á°ú°¡ ¾øÀ» ¼ö ÀÖ¾î¿ä.
              </div>
              <div className="mt-2 text-sm text-zinc-500">
                ¿¹½Ã °Ë»ö¾î: ¼ö¿­, ¹ÌºĞ, È®·ü
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-700 transition hover:border-zinc-400"
                >
                  ÇÊÅÍ/°Ë»ö¾î ÃÊ±âÈ­
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <QuestionCard key={item.id} question={item} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function FilterInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

