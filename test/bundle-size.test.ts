import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

import {
  findForbiddenBuiltinImports,
  findForbiddenDynamicNodeImports,
  isForbiddenBuiltinSpecifier,
} from "../scripts/bundle-leak-detector.js";

/**
 * Edge-budget guardrail.
 *
 * Cloudflare Workers free-tier upload limit is 1 MiB compressed. Many
 * deploy targets enforce 50-100 KiB budgets per worker for cold-start
 * latency. We hold a generous-but-bounded ceiling here so the bundled
 * stopword set, scoring math, and dedup helpers don't grow unnoticed.
 *
 * The leak detection lives in `scripts/bundle-leak-detector.ts` and runs
 * in two passes: a metafile import-graph check (catches every static
 * `import` / static `import("node:fs")` / `require("fs")`) and a regex
 * pass over the bundle text (catches literal-prefix dynamic imports
 * esbuild leaves external). Computed dynamic imports such as
 * `import("node:" + name)` are deliberately out of scope and noted in
 * the helper docblock — that case must be guarded at the source-lint
 * layer, not in the bundle.
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

    // Layer 1: walk esbuild's import graph (catches static imports and
    // static-string dynamic imports recorded in the metafile).
    expect(result.metafile).toBeDefined();
    const leakedImports = findForbiddenBuiltinImports(result.metafile!);
    expect(leakedImports, `bundle leaked Node built-in imports: ${leakedImports.join(", ")}`).toEqual([]);

    // Layer 2: regex over the bundle text catches literal-prefix dynamic
    // imports that esbuild leaves external (e.g. `import("node:fs")`).
    // Computed-prefix forms like `import("node:" + name)` are deliberately
    // not detected here — see the helper docblock.
    const dynamicLeaks = findForbiddenDynamicNodeImports(output.text);
    expect(dynamicLeaks, `bundle leaked literal-prefix dynamic Node imports: ${dynamicLeaks.join(", ")}`).toEqual([]);

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

describe("findForbiddenDynamicNodeImports", () => {
  it("flags literal-prefix dynamic imports of node:* modules", () => {
    const sample = `const a = import("node:fs"); const b = require('node:path');`;
    expect(findForbiddenDynamicNodeImports(sample)).toEqual([
      `import("node:fs")`,
      `require('node:path')`,
    ]);
  });

  it("returns an empty list for benign sources", () => {
    expect(findForbiddenDynamicNodeImports(`const note = "node:fs not used";`)).toEqual([]);
    expect(findForbiddenDynamicNodeImports(`import x from "./local";`)).toEqual([]);
    expect(findForbiddenDynamicNodeImports("")).toEqual([]);
  });

  it("documented limitation: does NOT detect computed-prefix dynamic imports", () => {
    // `import("node:" + name)` is computed at runtime — the helper sees
    // the string `"node:"` standing alone (not a complete specifier
    // inside `import(...)`). This is intentional; computed forms must
    // be guarded at the source-lint layer instead.
    const sample = `const m = await import("node:" + name);`;
    expect(findForbiddenDynamicNodeImports(sample)).toEqual([]);
  });
});
