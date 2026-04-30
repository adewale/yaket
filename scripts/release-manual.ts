import { spawnSync } from "node:child_process";

const version = process.argv[2];
if (version == null || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail("Usage: npm run release:manual -- X.Y.Z");
}

const tag = `v${version}`;

run("git", ["diff", "--quiet"]);
run("git", ["diff", "--cached", "--quiet"]);
assertOutput("git", ["branch", "--show-current"], "main", "Manual releases must run from main");
run("git", ["fetch", "origin", "main", "--tags"]);
assertOutput("git", ["rev-parse", "HEAD"], output("git", ["rev-parse", "origin/main"]), "main must match origin/main before releasing");

if (output("git", ["tag", "--list", tag]) !== "") {
  fail(`Tag ${tag} already exists`);
}

assertOutput("node", ["-p", "require('./package.json').version"], version, "package.json version mismatch");
assertOutput("node", ["-p", "require('./package-lock.json').version"], version, "package-lock.json version mismatch");
assertOutput("node", ["-p", "require('./package-lock.json').packages[''].version"], version, "package-lock.json root package version mismatch");

if (!output("node", ["-e", `const fs=require('node:fs'); process.stdout.write(fs.readFileSync('CHANGELOG.md','utf8').includes('## ${version} - ') ? 'yes' : 'no')`]).includes("yes")) {
  fail(`CHANGELOG.md must contain a dated heading for ${version}`);
}

run("npm", ["ci"]);
run("npm", ["run", "verify"]);
run("git", ["tag", "-a", tag, "-m", `Release Yaket ${version}`]);

// npm publish is the point of no return. Do not push the git tag or create a
// GitHub release until the registry has accepted the package.
run("npm", ["publish", "--access", "public"]);
run("git", ["push", "origin", "main"]);
run("git", ["push", "origin", tag]);

if (output("sh", ["-c", "command -v gh || true"]) !== "") {
  run("gh", ["release", "create", tag, "--generate-notes", "--verify-tag"]);
} else {
  process.stderr.write(`gh not found; create the GitHub release manually after confirming npm version ${version}.\n`);
}

function run(command: string, args: string[]): void {
  process.stderr.write(`$ ${command} ${args.join(" ")}\n`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed with status ${result.status ?? "unknown"}`);
  }
}

function output(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function assertOutput(command: string, args: string[], expected: string, message: string): void {
  const actual = output(command, args);
  if (actual !== expected) {
    fail(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
