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
    expect(demoHtml).toContain("Compare");
  });

  it("shows a direct Yaket versus TF-IDF comparison", () => {
    expect(demoHtml).toContain("Yaket results");
    expect(demoHtml).toContain("TF-IDF baseline");
    expect(demoHtml).toContain("Overlap");
  });

  it("keeps the comparison panel above the fold in the main layout", () => {
    expect(demoHtml).toContain('class="layout"');
    expect(demoHtml).toContain('results-panel');
  });

  it("uses the current published package line in the browser import", () => {
    expect(demoHtml).toContain("@ade_oshineye/yaket@0.4.0");
  });

  it("documents how to read the ranking and score", () => {
    expect(demoHtml).toContain("Lower score means more relevant");
    expect(demoHtml).toContain("Compare Yaket and TF-IDF on the same text");
  });

  it("makes compare interactions visibly update the results panel", () => {
    expect(demoHtml).toContain("Updated");
    expect(demoHtml).toContain("resultsPanel.classList.add(\"updated\")");
    expect(demoHtml).toContain("compareButton.textContent = \"Comparing…\"");
  });

  it("drops extra chrome and secondary sections", () => {
    expect(demoHtml).not.toContain("Why this page matters");
    expect(demoHtml).not.toContain("What this demo proves");
    expect(demoHtml).not.toContain("Highlighted text");
    expect(demoHtml).not.toContain("Copy Yaket results");
    expect(demoHtml).not.toContain("Summary");
    expect(demoHtml).not.toContain("Where Yaket fits");
  });
});
