import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const demoHtml = readFileSync(join(process.cwd(), "demo/index.html"), "utf8");

describe("demo page", () => {
  it("uses a snappier title", () => {
    expect(demoHtml).toContain("<title>Yaket vs TF-IDF</title>");
    expect(demoHtml).toContain("<h1>Yaket vs TF-IDF</h1>");
  });

  it("explains what differentiates YAKE", () => {
    expect(demoHtml).toContain("Single-document");
    expect(demoHtml).toContain("No training corpus");
    expect(demoHtml).toContain("Local statistical features");
  });

  it("uses a single simple sample picker and conventional controls", () => {
    expect(demoHtml).toContain("Sample text");
    expect(demoHtml).toContain("select id=");
    expect(demoHtml).toContain("News article");
    expect(demoHtml).toContain("Scientific abstract");
    expect(demoHtml).toContain("Newsletter");
    expect(demoHtml).toContain("Product docs");
    expect(demoHtml).toContain('id="run"');
  });

  it("shows a direct Yaket versus TF-IDF comparison", () => {
    expect(demoHtml).toContain("Yaket results");
    expect(demoHtml).toContain("TF-IDF baseline");
    expect(demoHtml).toContain("Yaket highlights");
    expect(demoHtml).toContain("TF-IDF highlights");
    expect(demoHtml).toContain("Overlap");
  });

  it("keeps input and results together above the fold in the main layout", () => {
    expect(demoHtml).toContain('results-panel');
    expect(demoHtml).toContain('class="layout"');

    const sampleIndex = demoHtml.indexOf('id="sample"');
    const resultsIndex = demoHtml.indexOf('id="results-panel"');

    expect(sampleIndex).toBeGreaterThanOrEqual(0);
    expect(resultsIndex).toBeGreaterThan(sampleIndex);
  });

  it("uses the current published package line in the browser import", () => {
    expect(demoHtml).toContain("@ade_oshineye/yaket@0.4.0");
  });

  it("focuses on surfaced topics instead of scores", () => {
    expect(demoHtml).toContain("Compare Yaket and TF-IDF on the same text");
    expect(demoHtml).not.toContain("Score");
    expect(demoHtml).not.toContain("Lower score means more relevant");
  });

  it("makes sample and configuration changes visibly update the results panel", () => {
    expect(demoHtml).toContain("Updated");
    expect(demoHtml).toContain("resultsPanel.classList.add(\"updated\")");
    expect(demoHtml).toContain("sample.addEventListener(\"change\"");
    expect(demoHtml).toContain("compareButton.textContent = \"Comparing…\"");
  });

  it("drops extra chrome and secondary sections", () => {
    expect(demoHtml).not.toContain("Why this page matters");
    expect(demoHtml).not.toContain("What this demo proves");
    expect(demoHtml).not.toContain("Copy Yaket results");
    expect(demoHtml).not.toContain("Summary");
    expect(demoHtml).not.toContain("Where Yaket fits");
  });
});
