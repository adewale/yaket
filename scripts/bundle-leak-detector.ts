/**
 * Shared list of Node-only built-in module names that must never appear in
 * the worker-target bundle, plus a pattern builder used by both the
 * `bundle-size` script and `test/bundle-size.test.ts`. Keeping the list and
 * the pattern shape in one place prevents the script and the test from
 * silently disagreeing on what counts as a leak.
 *
 * This file is Node-only (it has no runtime dependencies, but it lives
 * outside `src/` so it never enters the published package graph).
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
 * Builds the list of literal strings that, if present in a bundle, indicate
 * that a Node-only built-in was pulled in. Each name is checked under both
 * single and double quote styles, with and without the `node:` prefix.
 */
export function buildForbiddenBuiltinPatterns(): string[] {
  const patterns: string[] = [];
  for (const name of FORBIDDEN_BUILTIN_NAMES) {
    patterns.push(`"${name}"`);
    patterns.push(`'${name}'`);
    patterns.push(`"node:${name}"`);
    patterns.push(`'node:${name}'`);
  }
  return patterns;
}

/**
 * Regex patterns that catch dynamic Node-built-in imports, which would slip
 * past static-string matching. Returned as a tuple of `[name, regex]` so
 * callers can produce useful failure messages.
 */
export const FORBIDDEN_DYNAMIC_IMPORT_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ["dynamic import('node:*')", /import\s*\(\s*["']node:/u],
  ["require('node:*')", /require\s*\(\s*["']node:/u],
];
