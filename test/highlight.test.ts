import { describe, expect, it } from "vitest";

import { TextHighlighter } from "../src/index.js";

describe("TextHighlighter", () => {
  it("highlights longer phrases before their subphrases", () => {
    const highlighter = new TextHighlighter();
    const text = "Google Cloud Platform helps teams build on Google Cloud.";
    const highlighted = highlighter.highlight(text, ["Google Cloud Platform", "Google Cloud"]);

    expect(highlighted).toBe("<mark>Google Cloud Platform</mark> helps teams build on <mark>Google Cloud</mark>.");
  });

  it("accepts Bobbin-style keyword objects", () => {
    const highlighter = new TextHighlighter({ highlightPre: "<span>", highlightPost: "</span>" });
    const text = "Machine learning improves machine learning systems.";
    const highlighted = highlighter.highlight(text, [{ keyword: "machine learning", score: 0.1 }]);

    expect(highlighted).toBe("<span>Machine learning</span> improves <span>machine learning</span> systems.");
  });

  it("does not highlight substrings inside larger words", () => {
    const highlighter = new TextHighlighter();
    const text = "keywordish keyword keyword.";
    const highlighted = highlighter.highlight(text, ["keyword"]);

    expect(highlighted).toBe("keywordish <mark>keyword</mark> <mark>keyword</mark>.");
  });

  it("escapes regex metacharacters in keywords", () => {
    const highlighter = new TextHighlighter();
    const text = "Use C++ and C# to build systems.";
    const highlighted = highlighter.highlight(text, ["C++", "C#"]);

    expect(highlighted).toBe("Use <mark>C++</mark> and <mark>C#</mark> to build systems.");
  });

  it("respects maxNgramSize filtering and leaves text unchanged when nothing matches", () => {
    const highlighter = new TextHighlighter({ maxNgramSize: 1 });
    const text = "Google Cloud Platform helps teams.";

    expect(highlighter.highlight(text, ["Google Cloud Platform"])) .toBe(text);
  });
});
