import { describe, expect, it } from "vitest";

import { extractKeywordDetails, extractKeywords } from "../src/index.js";

const text = "Cloudflare Workers run JavaScript at the edge. Modern edge runtimes shrink the gap between developers and the people who use their software.";

describe("YAKE feature-filter option", () => {
  it("default features=null computes the full YAKE score", () => {
    const baseline = extractKeywordDetails(text, { language: "en", n: 2, top: 10 });
    expect(baseline.length).toBeGreaterThan(0);
    // All scores are positive and finite under the full feature set.
    expect(baseline.every((entry) => entry.score > 0 && Number.isFinite(entry.score))).toBe(true);
  });

  it("features=[] produces a different ranking than the default features=null", () => {
    const baseline = extractKeywords(text, { language: "en", n: 2, top: 10 });
    const noFeatures = extractKeywords(text, { language: "en", n: 2, top: 10, features: [] });

    // With no features computed, every SingleWord uses the placeholder defaults
    // (wcase=0, wfreq=0, wpos=1, wrel=1, wspread=0). That changes the H formula
    // for every candidate, so the ranking must differ from the full-feature run.
    expect(noFeatures.map(([keyword]) => keyword)).not.toEqual(baseline.map(([keyword]) => keyword));
  });

  it("features=['wfreq'] only computes wfreq and leaves the rest at their defaults", () => {
    const wfreqOnly = extractKeywords(text, { language: "en", n: 2, top: 10, features: ["wfreq"] });
    const noFeatures = extractKeywords(text, { language: "en", n: 2, top: 10, features: [] });

    // Selecting a single feature must produce a *different* ranking than
    // computing none of them — otherwise the feature filter is a no-op.
    expect(wfreqOnly.map(([keyword]) => keyword)).not.toEqual(noFeatures.map(([keyword]) => keyword));
  });

  it("features filter is deterministic across repeated runs", () => {
    const first = extractKeywords(text, { language: "en", n: 3, top: 10, features: ["wfreq", "wcase"] });
    const second = extractKeywords(text, { language: "en", n: 3, top: 10, features: ["wfreq", "wcase"] });
    expect(second).toEqual(first);
  });

  it("features=null applies KPF tf scaling on multi-word candidates with repeated phrases", () => {
    // The default features=null path computes all single-word features AND
    // includes "KPF" for the multi-word path. Two runs on text where a phrase
    // repeats N times must score the repeated phrase strictly better (lower)
    // than the same text with a single repetition — that proves the
    // tfUsed=this.tf branch is being exercised.
    const repetitiveText = "data science workflow data science workflow data science workflow.";
    const singleText = "data science workflow.";

    const repeated = extractKeywords(repetitiveText, { language: "en", n: 3, top: 5 });
    const single = extractKeywords(singleText, { language: "en", n: 3, top: 5 });

    const repeatedPhrase = repeated.find(([keyword]) => keyword === "data science workflow");
    const singlePhrase = single.find(([keyword]) => keyword === "data science workflow");
    expect(repeatedPhrase).toBeDefined();
    expect(singlePhrase).toBeDefined();
    // With KPF on, the repeated phrase divides by its higher tf and ranks
    // strictly better (lower H) than the single occurrence.
    expect(repeatedPhrase![1]).toBeLessThan(singlePhrase![1]);
  });
});
