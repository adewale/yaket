import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// A test gated on the Python YAKE reference only counts if some CI lane both
// provides the reference and selects the file. Two such files once existed
// that no lane ever ran. These checks keep the python-parity lane in step with
// the gated files and with the workflows that run it.

const root = process.cwd();
const read = (...parts: string[]): string => readFileSync(join(root, ...parts), "utf8");

function parityScriptFiles(): string[] {
  const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;
  const command = scripts["test:python-parity"] ?? "";
  return command.split(/\s+/).filter((token) => token.startsWith("test/")).sort();
}

function pythonGatedTestFiles(): string[] {
  return readdirSync(join(root, "test"))
    .filter((name) => name.endsWith(".test.ts"))
    .filter((name) => /from "\.\/helpers\/python-reference\.js"/.test(read("test", name)))
    .map((name) => `test/${name}`)
    .sort();
}

describe("python parity lane", () => {
  it("selects every test file gated on the Python YAKE reference", () => {
    const gated = pythonGatedTestFiles();
    expect(gated.length).toBeGreaterThan(0);
    expect(parityScriptFiles()).toEqual(expect.arrayContaining(gated));
  });

  it("gates Python-dependent tests only through the shared helper", () => {
    const adHoc = readdirSync(join(root, "test"))
      .filter((name) => name.endsWith(".test.ts") && name !== "python-parity-lane.test.ts")
      .filter((name) => /YAKET_PYTHONPATH"\]\s*\?\?/.test(read("test", name)));
    expect(adHoc).toEqual([]);
  });

  it.each([
    [".github/workflows/ci.yml"],
    [".github/workflows/release.yml"],
  ])("%s prepares the pinned reference and requires it", (workflow) => {
    const text = read(workflow);
    expect(text).toContain("scripts/setup-python-parity.sh");
    expect(text).toContain("npm run test:python-parity");
    expect(text).toContain('YAKET_REQUIRE_PYTHON_REFERENCE: "1"');
    // The pin and the dependency versions live only in the setup script and
    // its requirements file; a second copy in a workflow could drift.
    expect(text).not.toMatch(/\b[0-9a-f]{40}\b/);
    expect(text).not.toMatch(/pip install [^-\n]*==/);
  });

  it("pins the upstream YAKE reference to a full commit", () => {
    expect(read("scripts", "setup-python-parity.sh")).toMatch(/^YAKE_COMMIT="[0-9a-f]{40}"/m);
  });
});
