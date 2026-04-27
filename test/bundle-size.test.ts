import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

import { buildForbiddenBuiltinPatterns, FORBIDDEN_DYNAMIC_IMPORT_PATTERNS } from "../scripts/bundle-leak-detector.js";

/**
 * Edge-budget guardrail.
 *
 * Cloudflare Workers free-tier upload limit is 1 MiB compressed. Many
 * deploy targets enforce 50-100 KiB budgets per worker for cold-start
 * latency. We hold a generous-but-bounded ceiling here so the bundled
 * stopword set, scoring math, and dedup helpers don't grow unnoticed.
 *
 * The list of Node built-in module names and the pattern builder live in
 * `scripts/bundle-leak-detector.ts`, which is shared with the
 * `npm run bundle-size` script. That keeps the script and the test from
 * silently disagreeing on what counts as a leak.
 */
const MINIFIED_GZIP_BUDGET_BYTES = 64 * 1024; // 64 KiB
const MINIFIED_RAW_BUDGET_BYTES = 192 * 1024; // 192 KiB

describe("bundle size guardrails", () => {
  it("worker-target bundle of src/index.ts stays inside the documented edge budget", async () => {
    const result = await build({
      entryPoints: [resolve(process.cwd(), "src/index.ts")],
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      write: false,
      minify: true,
      treeShaking: true,
      external: [],
      logLevel: "silent",
    });

    expect(result.errors).toHaveLength(0);
    const output = result.outputFiles[0]!;
    const bundleText = output.text;
    const rawBytes = output.contents.byteLength;
    const gzippedBytes = gzipSync(output.contents).byteLength;

    // Hard fail before doing anything else if Node-only modules leaked in.
    // We check both quote styles and both the bare and `node:`-prefixed forms.
    for (const pattern of buildForbiddenBuiltinPatterns()) {
      expect(bundleText, `bundle leaked Node built-in pattern: ${pattern}`).not.toContain(pattern);
    }

    // Also catch dynamic imports of Node built-ins that bypass static-string
    // matching. esbuild emits these for `import("node:fs")` style code.
    for (const [label, regex] of FORBIDDEN_DYNAMIC_IMPORT_PATTERNS) {
      expect(bundleText, `bundle leaked dynamic import: ${label}`).not.toMatch(regex);
    }

    // The bundle must not be empty (would mean tree-shaking went wrong).
    expect(rawBytes).toBeGreaterThan(50 * 1024);

    expect(rawBytes, `raw bytes ${rawBytes} exceeds budget ${MINIFIED_RAW_BUDGET_BYTES}`)
      .toBeLessThanOrEqual(MINIFIED_RAW_BUDGET_BYTES);
    expect(gzippedBytes, `gzipped bytes ${gzippedBytes} exceeds budget ${MINIFIED_GZIP_BUDGET_BYTES}`)
      .toBeLessThanOrEqual(MINIFIED_GZIP_BUDGET_BYTES);
  });
});
