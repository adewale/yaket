import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extractKeywords } from "../src/index.js";

const demoHtml = readFileSync(join(process.cwd(), "demo/index.html"), "utf8");

interface DemoSample {
  text: string;
  yaket: string[];
  tfidf: string[];
}

// The page embeds its precomputed results as `var D = {...};` in the inline
// script. Evaluate that literal so the tests read the data the page renders.
function demoData(): Record<string, DemoSample> {
  const match = demoHtml.match(/var D = (\{[\s\S]*?\n {6}\});/);
  if (match == null) {
    throw new Error("demo/index.html no longer embeds `var D = {...};`");
  }
  return new Function(`return ${match[1]}`)() as Record<string, DemoSample>;
}

function htmlText(fragment: string): string {
  return fragment.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", "\"").replaceAll("&#39;", "'");
}

const data = demoData();
const sampleIds = Object.keys(data);

describe("demo page", () => {
  it("has a plain title and one-line explanation", () => {
    expect(demoHtml).toContain("<title>Yaket vs TF-IDF</title>");
    expect(demoHtml).toContain("<h1>Yaket vs TF-IDF</h1>");
    expect(demoHtml).toContain("Top 10 keywords from the same text, sorted alphabetically.");
  });

  it("ships precomputed results with no runtime dependencies", () => {
    expect(demoHtml).not.toContain("esm.sh");
    expect(demoHtml).not.toMatch(/<script[^>]*\bsrc=/);
    expect(demoHtml).not.toContain('type="module"');
    expect(demoHtml).toContain("Precomputed results, no runtime dependencies");
  });

  // The page claims each Yaket column is Yaket's top 10. Recompute it with
  // the current extractor so a scoring or tokenizer change cannot leave the
  // published demo showing stale output. Compared as sets (code-point sort on
  // both sides) so the check does not depend on the ICU collation the page's
  // alphabetical display order was produced with.
  it.each(sampleIds)("Yaket column for %s is the current extractor's top 10", (id) => {
    const sample = data[id]!;
    const current = extractKeywords(sample.text, { language: "en", n: 3, top: 10 }).map(([keyword]) => keyword);

    expect([...sample.yaket].sort()).toEqual(current.sort());
  });

  it("has one tab per embedded sample, in order, with the first selected", () => {
    const tabs = [...demoHtml.matchAll(/<button role="tab" data-id="([^"]+)" aria-selected="(true|false)">/g)];

    expect(sampleIds.length).toBeGreaterThan(1);
    expect(tabs.map((tab) => tab[1])).toEqual(sampleIds);
    expect(tabs.map((tab) => tab[2])).toEqual(sampleIds.map((_, index) => (index === 0 ? "true" : "false")));
  });

  it("prerenders the selected sample's table and overlap line from the embedded data", () => {
    const first = data[sampleIds[0]!]!;
    const tbody = demoHtml.match(/<tbody id="tbody">([\s\S]*?)<\/tbody>/)?.[1] ?? "";
    const rows = [...tbody.matchAll(/<tr><td class="(shared|unique)">([^<]*)<\/td><td class="(shared|unique)">([^<]*)<\/td><\/tr>/g)]
      .map(([, yaketClass, yaket, tfidfClass, tfidf]) => [yaketClass, htmlText(yaket!), tfidfClass, htmlText(tfidf!)]);
    const expectedRows = Array.from({ length: Math.max(first.yaket.length, first.tfidf.length) }, (_, index) => {
      const yaket = first.yaket[index] ?? "";
      const tfidf = first.tfidf[index] ?? "";
      return [first.tfidf.includes(yaket) ? "shared" : "unique", yaket, first.yaket.includes(tfidf) ? "shared" : "unique", tfidf];
    });
    const shared = first.yaket.filter((keyword) => first.tfidf.includes(keyword)).length;

    expect(rows).toEqual(expectedRows);
    expect(demoHtml).toContain(`<p class="source" id="source">${first.text}</p>`);
    expect(demoHtml).toContain(`<p class="overlap-line" id="overlap-line"><strong>${shared}</strong> of ${expectedRows.length} terms shared</p>`);
  });

  it("styles the shared and unique classes the renderer assigns", () => {
    expect(demoHtml).toMatch(/\.shared \{[^}]+\}/);
    expect(demoHtml).toMatch(/\.unique \{[^}]+\}/);
  });
});
