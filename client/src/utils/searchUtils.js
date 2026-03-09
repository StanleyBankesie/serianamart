export function normalizeString(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function wordBoundaryIndex(haystack, needle) {
  // Find if needle matches at start of any word in haystack
  const idx = haystack.indexOf(needle);
  if (idx <= 0) return idx;
  // Check previous char is space or punctuation
  const prev = haystack[idx - 1];
  return /\s|[_\-./]/.test(prev) ? idx : -1;
}

export function rankMatch(str, query) {
  const h = normalizeString(str);
  const q = normalizeString(query);
  if (!q) return Number.MAX_SAFE_INTEGER;
  if (h.startsWith(q)) return 0;
  const wb = wordBoundaryIndex(h, q);
  if (wb === 0) return 0;
  if (wb > 0) return 1;
  const any = h.indexOf(q);
  if (any >= 0) return 2 + any / 1000; // prefer earlier positions slightly
  return Infinity;
}

export function filterAndSort(items, { query, getKeys }) {
  const q = normalizeString(query || "");
  if (!q) return items.slice();
  // Build scored list
  const scored = [];
  for (const it of items) {
    const keys = (getKeys && getKeys(it)) || [];
    let best = Infinity;
    for (const k of keys) {
      const r = rankMatch(String(k || ""), q);
      if (r < best) best = r;
    }
    if (best !== Infinity) {
      scored.push({ it, score: best, key: normalizeString(keys[0] || "") });
    }
  }
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.key.localeCompare(b.key);
  });
  return scored.map((s) => s.it);
}
