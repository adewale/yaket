import { describe, expect, it } from "vitest";

import { extractYakeKeywords } from "../src/index.js";

const NEWSLETTER_CHUNK = `Consumer AI is being absorbed by platforms. Enterprise AI converges around a few vendors. Vertical AI is the third path. If consumer gets absorbed by incumbents and enterprise consolidates around platforms, vertical AI carves out domain-specific value. The APIs become commodities. Meta just acqui-hired both Gizmo and Dreamer. Karpathy's software model evolves. The ecosystem grows through network effects.`;

describe("Bobbin validation corpus", () => {
  it("keeps the top newsletter keywords stable", () => {
    const keywords = extractYakeKeywords(NEWSLETTER_CHUNK, 5, 3);

    expect(keywords).toEqual([
      { keyword: "vertical", score: 0.17777439245462645 },
      { keyword: "gizmo and dreamer", score: 0.18107633969826237 },
      { keyword: "platforms", score: 0.18904181613756502 },
      { keyword: "absorbed", score: 0.226396901979683 },
      { keyword: "consumer", score: 0.2597043637758384 },
    ]);
  });

  it("keeps at least one multi-word phrase in the top results", () => {
    const keywords = extractYakeKeywords(NEWSLETTER_CHUNK, 5, 3);
    expect(keywords.some((item) => item.keyword.includes(" "))).toBe(true);
  });

  it("returns results in lowercase ascending-score order", () => {
    const keywords = extractYakeKeywords(NEWSLETTER_CHUNK, 5, 3);

    expect(keywords.every((item) => item.keyword === item.keyword.toLowerCase())).toBe(true);
    for (let index = 1; index < keywords.length; index += 1) {
      expect(keywords[index]!.score).toBeGreaterThanOrEqual(keywords[index - 1]!.score);
    }
  });
});
