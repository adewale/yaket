import type { Metafile } from "esbuild";

/**
 * Shared bundle-leak detection used by both the `npm run bundle-size` script
 * and `test/bundle-size.test.ts`. Uses esbuild's metafile (the actual import
 * graph) instead of greppable strings, so harmless string literals like
 * `"process"`, `"path"`, or `"url"` that appear in user-facing text cannot
 * false-positive as Node-built-in leaks.
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
 *
 * Using the metafile (rather than grep-style string matching on the bundle
 * text) avoids false positives on innocent string literals that happen to
 * share a name with a built-in module.
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
