import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const demoHtml = readFileSync(join(process.cwd(), "demo/index.html"), "utf8");

describe("demo page", () => {
  it("uses the Yaket versus TF-IDF title", () => {
    expect(demoHtml).toContain("<title>Yaket vs TF-IDF</title>");
    expect(demoHtml).toContain("<h1>Yaket vs TF-IDF</h1>");
  });

  it("explains what differentiates YAKE", () => {
    expect(demoHtml).toContain("Single-document");
    expect(demoHtml).toContain("No training corpus");
    expect(demoHtml).toContain("Local statistical features");
  });

  it("uses a tabbed sample chooser with an attached sample panel", () => {
    expect(demoHtml).toContain('role="tablist"');
    expect(demoHtml).toContain('role="tabpanel"');
    expect(demoHtml).toContain('id="sample-tabs"');
    expect(demoHtml).toContain('id="sample-title"');
    expect(demoHtml).toContain('id="sample-text"');
    expect(demoHtml).toContain('button.setAttribute("role", "tab")');
    expect(demoHtml).toContain("Scientific abstract");
    expect(demoHtml).toContain("News article");
    expect(demoHtml).toContain("Newsletter");
    expect(demoHtml).toContain("Product docs");
  });

  it("shows only a simple two-column keyword comparison table", () => {
    expect(demoHtml).toContain("<th scope=\"col\">Yaket</th>");
    expect(demoHtml).toContain("<th scope=\"col\">TF-IDF</th>");
    expect(demoHtml).toContain('class="results-table"');
    expect(demoHtml).toContain('id="results-body"');
    expect(demoHtml).not.toContain("Yaket highlights");
    expect(demoHtml).not.toContain("TF-IDF highlights");
    expect(demoHtml).not.toContain("Overlap");
  });

  it("puts the results panel below the sample chooser", () => {
    const sampleTabsIndex = demoHtml.indexOf('id="sample-tabs"');
    const samplePanelIndex = demoHtml.indexOf('id="sample-panel"');
    const resultsPanelIndex = demoHtml.indexOf('id="results-panel"');

    expect(sampleTabsIndex).toBeGreaterThanOrEqual(0);
    expect(samplePanelIndex).toBeGreaterThan(sampleTabsIndex);
    expect(resultsPanelIndex).toBeGreaterThan(samplePanelIndex);
  });

  it("uses the current published package line in the browser import", () => {
    expect(demoHtml).toContain("@ade_oshineye/yaket@0.4.0");
  });

  it("sorts displayed keywords alphabetically for easier comparison", () => {
    expect(demoHtml).toContain("function sortKeywords");
    expect(demoHtml).toContain('localeCompare(right, undefined, { sensitivity: "base" })');
  });

  it("updates the sample panel and results immediately when a tab is clicked", () => {
    expect(demoHtml).toContain('button.addEventListener("click", () => applySample(item.id))');
    expect(demoHtml).toContain('sampleTitle.textContent = sample.label');
    expect(demoHtml).toContain('sampleText.textContent = sample.text');
    expect(demoHtml).toContain("renderResults(sample)");
  });

  it("drops the old config and extra comparison chrome", () => {
    expect(demoHtml).not.toContain('id="controls"');
    expect(demoHtml).not.toContain('id="language"');
    expect(demoHtml).not.toContain('id="top"');
    expect(demoHtml).not.toContain('id="ngram"');
    expect(demoHtml).not.toContain('id="input"');
    expect(demoHtml).not.toContain("Compare again");
    expect(demoHtml).not.toContain("Updated");
  });
});
