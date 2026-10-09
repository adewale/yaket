// Post-build smoke test of the built package: dist entrypoints, the exports
// map, and the CLI. Run it after `npm run build` (`npm run verify` does).
//
// This used to be a vitest test that ran a full `tsc` build inside the test,
// which regularly exceeded vitest's default 5s timeout under CPU load. As a
// separate step it tests the dist that was actually built, with no timeout
// coupling.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const dist = (file: string): string => join(root, "dist", file);

function runCli(...args: string[]) {
  return spawnSync(process.execPath, [dist("cli.js"), ...args], { cwd: root, encoding: "utf8" });
}

async function main(): Promise<void> {
  for (const file of ["index.js", "cli.js"]) {
    assert.ok(existsSync(dist(file)), `dist/${file} is missing; run npm run build first`);
  }

  const pkg = await import(pathToFileURL(dist("index.js")).href);
  assert.equal(typeof pkg.extractKeywords, "function", "dist/index.js must export extractKeywords");
  assert.equal(typeof pkg.TextHighlighter, "function", "dist/index.js must export TextHighlighter");

  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    exports: Record<string, { types: string; import: string }>;
  };
  for (const entry of [".", "./browser", "./worker"]) {
    const target = packageJson.exports[entry];
    assert.ok(target, `package.json exports is missing "${entry}"`);
    assert.ok(existsSync(join(root, target.import)), `exports["${entry}"].import points at missing ${target.import}`);
    assert.ok(existsSync(join(root, target.types)), `exports["${entry}"].types points at missing ${target.types}`);
  }

  const help = runCli("--help");
  assert.equal(help.status, 0, `yaket --help exited ${help.status}: ${help.stderr}`);
  assert.match(help.stdout, /Usage: yaket/);

  const text = runCli("--text-input", "Cloudflare Workers execute close to users.", "--top", "3");
  assert.equal(text.status, 0, `yaket --text-input exited ${text.status}: ${text.stderr}`);
  assert.equal(text.stdout.trim().split("\n").length, 3, `expected 3 keywords, got:\n${text.stdout}`);

  const verbose = runCli("--text-input", "Cloudflare Workers execute close to users.", "--top", "2", "--verbose");
  assert.equal(verbose.status, 0, `yaket --verbose exited ${verbose.status}: ${verbose.stderr}`);
  assert.equal((JSON.parse(verbose.stdout) as unknown[]).length, 2);

  const missing = runCli("--input-file", "missing.txt");
  assert.notEqual(missing.status, 0, "yaket must fail on a missing input file");
  assert.match(missing.stderr, /failed to read input file/);

  process.stdout.write("package smoke: ok\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
