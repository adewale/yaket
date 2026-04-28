import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FORBIDDEN_BUILTIN_NAMES } from "../scripts/bundle-leak-detector.js";

const SOURCE_DIR = join(process.cwd(), "src");

/**
 * Source-level pre-check that complements the bundle-level check in
 * `test/bundle-size.test.ts`. The bundle test is authoritative because it
 * walks the actual import graph; this test is faster and catches obvious
 * `import` / `require` statements without spinning up esbuild.
 *
 * The forbidden-name list is shared with the bundle-leak detector so the
 * two checks cannot drift out of sync.
 */
function buildForbiddenImportPatterns(): RegExp[] {
  const patterns: RegExp[] = [];
  for (const name of FORBIDDEN_BUILTIN_NAMES) {
    const escaped = name.replace(/\//g, "\\/");
    patterns.push(new RegExp(`from\\s+["']${escaped}["']`));
    patterns.push(new RegExp(`from\\s+["']node:${escaped}["']`));
    patterns.push(new RegExp(`require\\s*\\(\\s*["']${escaped}["']\\s*\\)`));
    patterns.push(new RegExp(`require\\s*\\(\\s*["']node:${escaped}["']\\s*\\)`));
    patterns.push(new RegExp(`import\\s*\\(\\s*["']${escaped}["']\\s*\\)`));
    patterns.push(new RegExp(`import\\s*\\(\\s*["']node:${escaped}["']\\s*\\)`));
  }
  return patterns;
}

describe("edge compatibility guard (source-level)", () => {
  const forbiddenPatterns = buildForbiddenImportPatterns();

  it("keeps the extraction source free of Node-only runtime imports", () => {
    const sourceFiles = readdirSync(SOURCE_DIR).filter((entry) => entry.endsWith(".ts") && entry !== "cli.ts");
    expect(sourceFiles.length).toBeGreaterThanOrEqual(10);

    for (const fileName of sourceFiles) {
      const source = readFileSync(join(SOURCE_DIR, fileName), "utf8");
      for (const pattern of forbiddenPatterns) {
        expect(source, `src/${fileName} matched forbidden import pattern: ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("only allows Node built-in imports inside src/cli.ts", () => {
    const cliSource = readFileSync(join(SOURCE_DIR, "cli.ts"), "utf8");
    // The CLI is allowed to use node:fs (for --input-file). Just confirm the
    // file is non-empty so a future "delete cli.ts" doesn't silently turn this
    // assertion into a no-op.
    expect(cliSource.length).toBeGreaterThan(100);
  });
});
