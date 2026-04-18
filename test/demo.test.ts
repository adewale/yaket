import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const demoHtml = readFileSync(join(process.cwd(), "demo/index.html"), "utf8");

describe("demo page", () => {
  it("uses the Yaket versus TF-IDF title", () => {
    expect(demoHtml).toContain("<title>Yaket vs TF-IDF</title>");
    expect(demoHtml).toContain("<h1>Yaket vs TF-IDF, without the wait.</h1>");
  });

  it("uses a richer scene-gallery layout inspired by the Garten demo language", () => {
    expect(demoHtml).toContain("Sample Scenes");
    expect(demoHtml).toContain("Results Snapshot");
    expect(demoHtml).toContain('class="scene-grid"');
    expect(demoHtml).toContain('class="scene-card"');
    expect(demoHtml).toContain('class="signal-grid"');
    expect(demoHtml).toContain('class="metric-strip"');
  });

  it("ships meaningful content in the initial HTML instead of waiting for a remote module", () => {
    expect(demoHtml).toContain('id="sample-title">Scientific abstract<');
    expect(demoHtml).toContain('id="results-body"');
    expect(demoHtml).toContain("keyword extraction");
    expect(demoHtml).not.toContain("esm.sh");
    expect(demoHtml).not.toContain("type=\"module\"");
  });

  it("uses a tabbed sample chooser with pre-rendered scene cards", () => {
    expect(demoHtml).toContain('role="tablist"');
    expect(demoHtml).toContain('role="tab"');
    expect(demoHtml).toContain('role="tabpanel"');
    expect(demoHtml).toContain('id="tab-abstract"');
    expect(demoHtml).toContain('id="tab-news"');
    expect(demoHtml).toContain('id="tab-newsletter"');
    expect(demoHtml).toContain('id="tab-product-docs"');
  });

  it("keeps the comparison as a two-column keyword table", () => {
    expect(demoHtml).toContain("<th scope=\"col\">Yaket</th>");
    expect(demoHtml).toContain("<th scope=\"col\">TF-IDF</th>");
    expect(demoHtml).toContain('class="results-table"');
    expect(demoHtml).not.toContain("Yaket highlights");
    expect(demoHtml).not.toContain("TF-IDF highlights");
    expect(demoHtml).not.toContain("Overlap section");
  });

  it("makes the comparison philosophy explicit", () => {
    expect(demoHtml).toContain("Alphabetized output");
    expect(demoHtml).toContain("Sorted for quick visual scanning");
    expect(demoHtml).toContain("The point here is surfacing, not score drama");
  });

  it("precomputes sample outputs for instant scene switching", () => {
    expect(demoHtml).toContain("const SAMPLE_RESULTS = {");
    expect(demoHtml).toContain("renderSample(tab.dataset.sampleId)");
    expect(demoHtml).toContain("Shared terms:");
    expect(demoHtml).toContain("currentSampleId = \"abstract\"");
  });

  it("keeps the mobile layout responsive", () => {
    expect(demoHtml).toContain("@media (max-width: 920px)");
    expect(demoHtml).toContain("@media (max-width: 680px)");
  });
});
