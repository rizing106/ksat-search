export function tokenizeQuery(input: string): {
  tokens: string[];
  bigrams: string[];
  trigrams: string[];
} {
  const lowered = String(input ?? "").toLowerCase();
  const normalized = lowered.replace(/[^0-9a-z가-힣]+/gi, " ").trim();
  const words = normalized.length ? normalized.split(/\s+/) : [];
  const tokens = limitUnique(
    words.filter((w) => w.length >= 2),
    500,
  );

  const compact = normalized.replace(/\s+/g, "");
  const bigrams = buildNgrams(compact, 2, 500);
  const trigrams = buildNgrams(compact, 3, 500);

  return { tokens, bigrams, trigrams };
}

function buildNgrams(text: string, size: number, limit: number): string[] {
  if (!text || text.length < size) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i <= text.length - size; i += 1) {
    const gram = text.slice(i, i + size);
    if (seen.has(gram)) continue;
    seen.add(gram);
    out.push(gram);
    if (out.length >= limit) break;
  }
  return out;
}

function limitUnique(items: string[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}
