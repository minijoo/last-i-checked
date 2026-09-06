// Tiny fuzzy matcher for the drill-down comboboxes. Subsequence match with
// bonuses for consecutive hits and word-start hits — enough for "nfl",
// "american football", and "americanfootball_nfl" to all find the NFL entry.
// No dependency; client-side only (lists are already in memory).

/** Case-insensitive score. Higher is better; 0 means no match. An empty query
 *  matches everything (score 1). */
export function fuzzyScore(query: string, target: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let streak = 0;
  let prev = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue;
    let s = 1;
    if (prev === ti - 1) {
      streak++;
      s += streak * 2;
    } else {
      streak = 0;
    }
    if (ti === 0 || /[\s\-_/.]/.test(t[ti - 1])) s += 3; // word-start bonus
    score += s;
    prev = ti;
    qi++;
  }
  return qi === q.length ? score : 0;
}

/** Filter + rank by the best score across each item's search strings. */
export function fuzzyFilter<T>(
  query: string,
  items: readonly T[],
  keys: (item: T) => Array<string | null | undefined>,
): T[] {
  const q = query.trim();
  if (!q) return [...items];
  return items
    .map((item) => {
      let best = 0;
      for (const k of keys(item)) {
        if (!k) continue;
        const s = fuzzyScore(q, k);
        if (s > best) best = s;
      }
      return { item, best };
    })
    .filter((x) => x.best > 0)
    .sort((a, b) => b.best - a.best)
    .map((x) => x.item);
}
