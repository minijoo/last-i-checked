export interface SelectorCandidate {
  index: number;
  text: string;
  selector: string;
}

/**
 * Runs inside the page via page.evaluate() — must be fully self-contained
 * (no closures over outer scope; Playwright serializes this function's
 * source and re-executes it in the browser). Walks visible, text-bearing
 * elements, drops wrapper nodes whose text duplicates a child's, and
 * computes a verified-unique CSS selector per candidate (id, then a data- or
 * aria- attribute, then class, then a structural nth-child path — the same
 * fallback ladder devtools uses internally). See docs/plan.md "AI-Assisted Selector
 * Suggestion — Technical Approach".
 */
export function extractCandidates(maxCandidates: number): SelectorCandidate[] {
  function isVisible(el: Element): boolean {
    if (el.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    if (parseFloat(style.opacity || "1") === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function ownText(el: Element): string {
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  // Text contributed directly by this element's own text nodes, ignoring
  // anything from nested elements. Empty means el is a pure layout wrapper
  // (its whole textContent comes from its children) — those are excluded
  // below in favor of the more specific children.
  function directOwnText(el: Element): string {
    let s = "";
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) s += node.textContent || "";
    }
    return s.replace(/\s+/g, " ").trim();
  }

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG"]);

  const all = Array.from(document.body.querySelectorAll("*")).filter((el) => {
    if (SKIP_TAGS.has(el.tagName)) return false;
    if (!isVisible(el)) return false;
    const text = ownText(el);
    return text.length > 0 && text.length <= 300;
  });

  const textOf = new Map<Element, string>(all.map((el) => [el, ownText(el)]));
  const keep = all.filter((el) => directOwnText(el).length > 0);

  function attrSelector(el: Element): string | null {
    for (const attr of Array.from(el.attributes)) {
      if (!/^(data-|aria-)/.test(attr.name) || !attr.value) continue;
      const sel = `[${attr.name}="${CSS.escape(attr.value)}"]`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }
    return null;
  }

  function classSelector(el: Element): string | null {
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList);
    for (let n = 1; n <= classes.length; n++) {
      const suffix = classes
        .slice(0, n)
        .map((c) => `.${CSS.escape(c)}`)
        .join("");
      for (const sel of [suffix, tag + suffix]) {
        if (document.querySelectorAll(sel).length === 1) return sel;
      }
    }
    return null;
  }

  function structuralSelector(el: Element): string {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body) {
      const parent: Element | null = node.parentElement;
      if (!parent) break;
      const i = Array.from(parent.children).indexOf(node) + 1;
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${i})`);
      const path = parts.join(" > ");
      if (document.querySelectorAll(path).length === 1) return path;
      node = parent;
    }
    return parts.join(" > ");
  }

  function selectorFor(el: Element): string | null {
    if (el.id) {
      const sel = `#${CSS.escape(el.id)}`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }
    return attrSelector(el) || classSelector(el) || structuralSelector(el);
  }

  const seen = new Set<string>();
  const out: SelectorCandidate[] = [];
  for (const el of keep) {
    if (out.length >= maxCandidates) break;
    const selector = selectorFor(el);
    if (!selector || seen.has(selector)) continue;
    seen.add(selector);
    const text = textOf.get(el)!;
    out.push({
      index: out.length,
      text: text.length > 100 ? `${text.slice(0, 100)}…` : text,
      selector,
    });
  }
  return out;
}
