import type { Metafile } from "esbuild";

/**
 * Shared bundle-leak detection used by both the `npm run bundle-size` script
 * and `test/bundle-size.test.ts`.
 *
 * The detector has two layers:
 *
 * 1. **Metafile-based import-graph check** (`findForbiddenBuiltinImports`).
 *    Walks esbuild's recorded import graph and flags any import specifier
 *    that resolves to a forbidden Node built-in. Specifier-level checking
 *    avoids false positives on innocent string literals like `"process"`,
 *    `"path"`, or `"url"` that may appear in user-facing strings.
 * 2. **Regex check on the bundle text** for literal `import("node:…")` and
 *    `require("node:…")` patterns (`findForbiddenDynamicNodeImports`).
 *    esbuild may emit these unresolved when the target platform cannot
 *    bundle the built-in. A literal-prefix dynamic import slips through
 *    the metafile when esbuild treats it as external.
 *
 * What neither layer catches:
 *
 * - **Computed dynamic imports**, e.g. `import("node:" + name)` or
 *   `import(getModuleName())`. The argument is not a static string at
 *   bundle time, so esbuild does not record a specifier we can match,
 *   and the bundle text contains the prefix only as part of an arbitrary
 *   expression. If you need to forbid every conceivable runtime-computed
 *   import, you also need to ban string-concatenation imports at the
 *   source-level lint layer.
 *
 * This file is Node-only (it depends on the `esbuild` Metafile type) and
 * lives in `scripts/` so it never enters the published package graph.
 */

/**
 * Node-only built-in module names that must never appear as imports in the
 * worker-target bundle. Both bare (`"fs"`) and `node:`-prefixed
 * (`"node:fs"`) specifiers are treated as the same forbidden import.
 */
export const FORBIDDEN_BUILTIN_NAMES: readonly string[] = [
  "fs",
  "fs/promises",
  "path",
  "path/posix",
  "child_process",
  "os",
  "url",
  "stream",
  "zlib",
  "crypto",
  "http",
  "https",
  "net",
  "tls",
  "worker_threads",
  "process",
  "util",
];

/**
 * Returns true when an import specifier resolves to one of the forbidden
 * Node built-ins, regardless of whether the `node:` prefix is present.
 */
export function isForbiddenBuiltinSpecifier(specifier: string): boolean {
  const bare = specifier.startsWith("node:") ? specifier.slice("node:".length) : specifier;
  return FORBIDDEN_BUILTIN_NAMES.includes(bare);
}

/**
 * Walks the esbuild metafile's input graph and returns every distinct
 * import specifier that resolves to a forbidden Node built-in. The result
 * is sorted for deterministic test output.
 */
export function findForbiddenBuiltinImports(metafile: Metafile): string[] {
  const found = new Set<string>();
  for (const input of Object.values(metafile.inputs)) {
    for (const imp of input.imports ?? []) {
      if (isForbiddenBuiltinSpecifier(imp.path)) {
        found.add(imp.path);
      }
    }
  }
  return [...found].sort();
}

const DYNAMIC_NODE_IMPORT_PATTERN = /import\s*\(\s*["']node:[^"']+["']\s*\)/gu;
const DYNAMIC_NODE_REQUIRE_PATTERN = /require\s*\(\s*["']node:[^"']+["']\s*\)/gu;

/**
 * Catches literal-prefix dynamic imports of `node:*` modules in the bundle
 * text. These survive in the bundle when esbuild leaves them external (it
 * does so when targeting `browser` and the module wasn't tree-shaken).
 *
 * Note: this only catches **literal** specifiers. Computed forms like
 * `import("node:" + name)` are not catchable from the bundle text alone —
 * forbid those at the source-lint layer if needed.
 */
export function findForbiddenDynamicNodeImports(bundleText: string): string[] {
  const matches = new Set<string>();
  for (const match of bundleText.matchAll(DYNAMIC_NODE_IMPORT_PATTERN)) {
    matches.add(match[0]);
  }
  for (const match of bundleText.matchAll(DYNAMIC_NODE_REQUIRE_PATTERN)) {
    matches.add(match[0]);
  }
  return [...matches].sort();
}
