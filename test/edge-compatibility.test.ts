import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE_DIR = join(process.cwd(), "src");
const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+["']node:fs["']/,
  /from\s+["']fs["']/,
  /from\s+["']node:path["']/,
  /from\s+["']path["']/,
  /from\s+["']node:child_process["']/,
  /from\s+["']child_process["']/,
  /from\s+["']node:os["']/,
  /from\s+["']os["']/,
];

describe("edge compatibility guard", () => {
  it("keeps the extraction source free of Node-only runtime imports", () => {
    for (const fileName of readdirSync(SOURCE_DIR).filter((entry) => entry.endsWith(".ts"))) {
      const source = readFileSync(join(SOURCE_DIR, fileName), "utf8");

      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    }
  });
});
