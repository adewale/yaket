import { describe, expect, it } from "vitest";

import { TextHighlighter } from "../src/index.js";

describe("TextHighlighter", () => {
  it("highlights longer phrases before their subphrases", () => {
    const highlighter = new TextHighlighter();
    const text = "Google Cloud Platform helps teams build on Google Cloud.";
    const highlighted = highlighter.highlight(text, ["Google Cloud Platform", "Google Cloud"]);

    expect(highlighted).toContain("<mark>Google Cloud Platform</mark>");
  });

  it("accepts Bobbin-style keyword objects", () => {
    const highlighter = new TextHighlighter({ highlightPre: "<span>", highlightPost: "</span>" });
    const text = "Machine learning improves machine learning systems.";
    const highlighted = highlighter.highlight(text, [{ keyword: "machine learning", score: 0.1 }]);

    expect(highlighted).toContain("<span>Machine learning</span>");
  });
});
