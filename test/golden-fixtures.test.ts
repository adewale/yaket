import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extractKeywordDetails } from "../src/index.js";

const INPUT_DIR = join(process.cwd(), "test/fixtures/input");
const EXPECTED_DIR = join(process.cwd(), "test/fixtures/expected");
const FIXTURE_NAMES = readdirSync(INPUT_DIR)
  .filter((entry) => entry.endsWith(".txt"))
  .map((entry) => entry.replace(/\.txt$/, ""));

describe("golden fixtures", () => {
  it("has fixture inputs", () => {
    expect(FIXTURE_NAMES.length).toBeGreaterThan(0);
  });

  for (const fixtureName of FIXTURE_NAMES) {
    it(`matches fixture ${fixtureName}`, () => {
      const input = readFileSync(join(INPUT_DIR, `${fixtureName}.txt`), "utf8");
      const expected = JSON.parse(readFileSync(join(EXPECTED_DIR, `${fixtureName}.json`), "utf8")) as ReturnType<typeof extractKeywordDetails>;
      const actual = extractKeywordDetails(input, { lan: "en", n: 3, top: 5 });

      expect(actual).toEqual(expected);
    });
  }
});
