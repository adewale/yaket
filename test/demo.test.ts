import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const demoHtml = readFileSync(join(process.cwd(), "demo/index.html"), "utf8");

describe("demo page", () => {
  it("explains what differentiates YAKE", () => {
    expect(demoHtml).toContain("Single-document");
    expect(demoHtml).toContain("No training corpus");
    expect(demoHtml).toContain("Local statistical features");
  });

  it("includes curated example presets and a highlighted-text view", () => {
    expect(demoHtml).toContain("Try a sample");
    expect(demoHtml).toContain("News article");
    expect(demoHtml).toContain("Scientific abstract");
    expect(demoHtml).toContain("Newsletter");
    expect(demoHtml).toContain("Highlighted text");
  });

  it("uses the current published package line in the browser import", () => {
    expect(demoHtml).toContain("@ade_oshineye/yaket@0.4.0");
  });

  it("documents how to read the ranking and score", () => {
    expect(demoHtml).toContain("Lower score means more relevant");
    expect(demoHtml).toContain("occurrences");
    expect(demoHtml).toContain("sentence spread");
  });
});
