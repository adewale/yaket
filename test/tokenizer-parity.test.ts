import { describe, expect, it } from "vitest";

import { splitSentences, tokenizeWords } from "../src/index.js";

describe("tokenizer and sentence splitting parity", () => {
  it("keeps trailing periods attached to abbreviations and initialisms", () => {
    expect(tokenizeWords("Dr. Smith met the U.S. team.")).toEqual([
      "Dr.",
      "Smith",
      "met",
      "the",
      "U.S.",
      "team",
      ".",
    ]);
    expect(tokenizeWords("Ph.D. students read e.g. examples.")).toEqual([
      "Ph.D.",
      "students",
      "read",
      "e.g.",
      "examples",
      ".",
    ]);
  });

  it("splits ellipsis-delimited sentences like segtok", () => {
    expect(splitSentences("Wait... what happened? Really...")).toEqual([
      "Wait...",
      "what happened?",
      "Really...",
    ]);
    expect(tokenizeWords("Wait...")).toEqual(["Wait", "..."]);
  });

  it("keeps parenthetical terminal punctuation inside the same sentence", () => {
    expect(splitSentences("Quoted parenthetical (really?). Next sentence.")).toEqual([
      "Quoted parenthetical (really?).",
      "Next sentence.",
    ]);
  });
});
