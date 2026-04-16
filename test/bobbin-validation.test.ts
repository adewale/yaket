import { describe, expect, it } from "vitest";

import { extractYakeKeywords } from "../src/index.js";

const NEWSLETTER_CHUNK = `Consumer AI is being absorbed by platforms. Enterprise AI converges around a few vendors. Vertical AI is the third path. If consumer gets absorbed by incumbents and enterprise consolidates around platforms, vertical AI carves out domain-specific value. The APIs become commodities. Meta just acqui-hired both Gizmo and Dreamer. Karpathy's software model evolves. The ecosystem grows through network effects.`;

describe("Bobbin validation corpus", () => {
  it("extracts domain-relevant phrases from newsletter-style text", () => {
    const keywords = extractYakeKeywords(NEWSLETTER_CHUNK, 5, 3);
    const names = keywords.map((item) => item.keyword);

    expect(names.some((name) =>
      name.includes("vertical") ||
      name.includes("consumer") ||
      name.includes("enterprise") ||
      name.includes("platform") ||
      name.includes("api") ||
      name.includes("ai"))).toBe(true);
  });

  it("keeps at least one multi-word phrase in the top results", () => {
    const keywords = extractYakeKeywords(NEWSLETTER_CHUNK, 5, 3);
    expect(keywords.some((item) => item.keyword.includes(" "))).toBe(true);
  });
});
