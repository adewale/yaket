import { describe, expect, it } from "vitest";

import { aggressivePreFilter, countSpaces, trigrams } from "../src/similarity.js";

describe("similarity internal helpers", () => {
  it("builds overlapping character trigrams exactly", () => {
    expect([...trigrams([..."abcd"])]).toEqual(["abc", "bcd"]);
    expect([...trigrams([..."ab"])]).toEqual([]);
  });

  it("counts only literal spaces", () => {
    expect(countSpaces("alpha beta  gamma\t delta")).toBe(4);
    expect(countSpaces("alphabetagamma")).toBe(0);
  });

  it("accepts identical candidates before other prefilter checks", () => {
    expect(aggressivePreFilter("same", "same")).toBe(true);
  });

  it("rejects candidates with excessive length skew", () => {
    expect(aggressivePreFilter("ab", "ab123456z")).toBe(false);
    expect(aggressivePreFilter("ab123z", "ab123456z")).toBe(true);
  });

  it("rejects long candidates with mismatched boundaries", () => {
    expect(aggressivePreFilter("abcd", "xbcd")).toBe(false);
    expect(aggressivePreFilter("abcd", "abce")).toBe(false);
    expect(aggressivePreFilter("ab", "xb")).toBe(true);
  });

  it("rejects long candidates with mismatched two-character prefixes", () => {
    expect(aggressivePreFilter("abcd", "axcd")).toBe(false);
    expect(aggressivePreFilter("abxd", "abyd")).toBe(true);
    expect(aggressivePreFilter("abc", "abc")).toBe(true);
  });

  it("rejects candidates with substantially different word counts", () => {
    expect(aggressivePreFilter("alpha beta gamma", "alpha beta")).toBe(true);
    expect(aggressivePreFilter("alpha beta gamma", "alpha")).toBe(false);
  });
});
