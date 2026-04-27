import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

import { findForbiddenBuiltinImports, isForbiddenBuiltinSpecifier } from "../scripts/bundle-leak-detector.js";

/**
 * Edge-budget guardrail.
 *
 * Cloudflare Workers free-tier upload limit is 1 MiB compressed. Many
 * deploy targets enforce 50-100 KiB budgets per worker for cold-start
 * latency. We hold a generous-but-bounded ceiling here so the bundled
 * stopword set, scoring math, and dedup helpers don't grow unnoticed.
 *
 * The forbidden-built-in detection lives in
 * `scripts/bundle-leak-detector.ts` and walks esbuild's metafile (the
 * actual import graph). Both the `npm run bundle-size` script and this
 * test import the helper, so they cannot disagree on what counts as a
 * leak — and innocent string literals like `"process"` or `"path"` in
 * user-facing text cannot false-positive.
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
      metafile: true,
      logLevel: "silent",
    });

    expect(result.errors).toHaveLength(0);
    const output = result.outputFiles[0]!;
    const rawBytes = output.contents.byteLength;
    const gzippedBytes = gzipSync(output.contents).byteLength;

    // Walk esbuild's import graph rather than grepping the bundle text.
    expect(result.metafile).toBeDefined();
    const leakedImports = findForbiddenBuiltinImports(result.metafile!);
    expect(leakedImports, `bundle leaked Node built-in imports: ${leakedImports.join(", ")}`).toEqual([]);

    // The bundle must not be empty (would mean tree-shaking went wrong).
    expect(rawBytes).toBeGreaterThan(50 * 1024);

    expect(rawBytes, `raw bytes ${rawBytes} exceeds budget ${MINIFIED_RAW_BUDGET_BYTES}`)
      .toBeLessThanOrEqual(MINIFIED_RAW_BUDGET_BYTES);
    expect(gzippedBytes, `gzipped bytes ${gzippedBytes} exceeds budget ${MINIFIED_GZIP_BUDGET_BYTES}`)
      .toBeLessThanOrEqual(MINIFIED_GZIP_BUDGET_BYTES);
  });
});

describe("isForbiddenBuiltinSpecifier", () => {
  it("matches both bare and node:-prefixed Node built-ins", () => {
    for (const name of ["fs", "fs/promises", "path", "child_process", "os", "crypto", "process", "util"]) {
      expect(isForbiddenBuiltinSpecifier(name)).toBe(true);
      expect(isForbiddenBuiltinSpecifier(`node:${name}`)).toBe(true);
    }
  });

  it("does not flag innocuous specifiers that share a prefix or contain a built-in name", () => {
    // These are legitimate package names that must NOT be flagged just because
    // they contain or look like built-in module names.
    expect(isForbiddenBuiltinSpecifier("process-text")).toBe(false);
    expect(isForbiddenBuiltinSpecifier("./os")).toBe(false);
    expect(isForbiddenBuiltinSpecifier("@scoped/path")).toBe(false);
    expect(isForbiddenBuiltinSpecifier("url-pattern")).toBe(false);
    expect(isForbiddenBuiltinSpecifier("crypto-js")).toBe(false);
    expect(isForbiddenBuiltinSpecifier("./path/to/local")).toBe(false);
  });

  it("does not flag bare strings that happen to share a built-in name in the source text", () => {
    // The check operates on import specifiers, not arbitrary strings. A
    // bundled string literal `"process"` inside user-facing text must not
    // be considered an import.
    // (There's no Node `import` here — we just confirm the helper is keyed
    // on its argument and doesn't depend on any global text-grep behavior.)
    expect(isForbiddenBuiltinSpecifier("Process the input then return.")).toBe(false);
    expect(isForbiddenBuiltinSpecifier("the path to success")).toBe(false);
  });
});
