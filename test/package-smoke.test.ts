import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("package smoke", () => {
  it("builds and exposes the dist entrypoints and CLI", async () => {
    const build = spawnSync(process.execPath, [join(process.cwd(), "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(build.status).toBe(0);

    expect(existsSync(join(process.cwd(), "dist/index.js"))).toBe(true);
    expect(existsSync(join(process.cwd(), "dist/cli.js"))).toBe(true);

    const pkg = await import(`file://${join(process.cwd(), "dist/index.js")}`);
    expect(typeof pkg.extractKeywords).toBe("function");
    expect(typeof pkg.TextHighlighter).toBe("function");

    const packageJson = await import(`file://${join(process.cwd(), "package.json")}`, { with: { type: "json" } });
    expect(Object.keys(packageJson.default.exports)).toEqual(expect.arrayContaining([".", "./browser", "./worker"]));

    const cliHelp = spawnSync("node", [join(process.cwd(), "dist/cli.js"), "--help"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(cliHelp.status).toBe(0);
    expect(cliHelp.stdout).toContain("Usage: yaket");

    const cliText = spawnSync("node", [join(process.cwd(), "dist/cli.js"), "--text-input", "Cloudflare Workers execute close to users.", "--top", "3"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(cliText.status).toBe(0);
    expect(cliText.stdout.trim().split("\n")).toHaveLength(3);

    const cliVerbose = spawnSync("node", [join(process.cwd(), "dist/cli.js"), "--text-input", "Cloudflare Workers execute close to users.", "--top", "2", "--verbose"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(cliVerbose.status).toBe(0);
    expect(JSON.parse(cliVerbose.stdout)).toHaveLength(2);

    const cliMissingFile = spawnSync("node", [join(process.cwd(), "dist/cli.js"), "--input-file", "missing.txt"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(cliMissingFile.status).not.toBe(0);
    expect(cliMissingFile.stderr).toContain("failed to read input file");
  });
});
