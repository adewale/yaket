import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const demoHtml = readFileSync(join(process.cwd(), "demo/index.html"), "utf8");

describe("demo page", () => {
  it("has a plain title and one-line explanation", () => {
    expect(demoHtml).toContain("<title>Yaket vs TF-IDF</title>");
    expect(demoHtml).toContain("<h1>Yaket vs TF-IDF</h1>");
    expect(demoHtml).toContain("Shared terms in white");
  });

  it("ships precomputed results with no runtime dependencies", () => {
    expect(demoHtml).not.toContain("esm.sh");
    expect(demoHtml).not.toContain('type="module"');
    expect(demoHtml).toContain("var D = {");
    expect(demoHtml).toContain("keyword extraction");
    expect(demoHtml).toContain("Precomputed results, no runtime dependencies");
  });

  it("has four sample tabs rendered in the initial HTML", () => {
    expect(demoHtml).toContain('role="tablist"');
    expect(demoHtml).toContain('role="tab"');
    expect(demoHtml).toContain('data-id="abstract"');
    expect(demoHtml).toContain('data-id="news"');
    expect(demoHtml).toContain('data-id="newsletter"');
    expect(demoHtml).toContain('data-id="product-docs"');
  });

  it("renders the default sample table rows in the initial HTML", () => {
    expect(demoHtml).toContain('<tbody id="tbody">');
    expect(demoHtml).toContain("keyword extraction");
    expect(demoHtml).toContain("based on multiple");
  });

  it("uses a plain two-column table with no decorative wrappers", () => {
    expect(demoHtml).toContain("<th>Yaket</th>");
    expect(demoHtml).toContain("<th>TF-IDF</th>");
    expect(demoHtml).not.toContain("keyword-chip");
    expect(demoHtml).not.toContain("signal-card");
    expect(demoHtml).not.toContain("metric-card");
    expect(demoHtml).not.toContain("scene-card");
    expect(demoHtml).not.toContain("eyebrow");
  });

  it("defines shared and unique term styles and uses them in rendering", () => {
    expect(demoHtml).toContain(".shared {");
    expect(demoHtml).toContain(".unique {");
    expect(demoHtml).toContain('class="unique"');
  });

  it("shows a single overlap count line instead of multiple metric cards", () => {
    expect(demoHtml).toContain('id="overlap-line"');
    expect(demoHtml).toContain("terms shared");
    expect(demoHtml).not.toContain("metric-strip");
  });
});
