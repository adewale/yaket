/**
 * Bundle-size reporter for the Yaket extraction core.
 *
 * Bundles the public entry point with esbuild in worker-shaped settings
 * (ESM, browser platform, Node-built-ins forbidden) and reports raw and
 * gzipped sizes for the JS bundle. Writes a markdown report to
 * `docs/benchmarks/bundle-size.md`.
 *
 * This is a Node-only script kept out of the extraction core import graph.
 */
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { findForbiddenBuiltinImports } from "./bundle-leak-detector.js";

interface VariantReport {
  readonly entry: string;
  readonly minified: boolean;
  readonly bytes: number;
  readonly gzippedBytes: number;
}

const VARIANTS = [
  { entry: "src/index.ts", minified: true },
  { entry: "src/index.ts", minified: false },
] as const;

async function main(): Promise<void> {
  const reports: VariantReport[] = [];

  for (const variant of VARIANTS) {
    const result = await build({
      entryPoints: [resolve(process.cwd(), variant.entry)],
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      write: false,
      minify: variant.minified,
      treeShaking: true,
      // The extraction core MUST NOT pull in any Node built-ins. If it does,
      // esbuild will emit an error and the build fails — which is exactly the
      // signal we want for the worker safety guarantee.
      external: [],
      // metafile is what `findForbiddenBuiltinImports` walks. It lists the
      // actual import graph, so user-facing strings like "process" or "url"
      // cannot false-positive as Node-built-in leaks.
      metafile: true,
      logLevel: "silent",
    });

    if (result.errors.length > 0) {
      throw new Error(`esbuild errors: ${result.errors.map((error) => error.text).join("; ")}`);
    }

    const output = result.outputFiles[0];
    if (output == null) {
      throw new Error("esbuild produced no output");
    }
    if (result.metafile == null) {
      throw new Error("esbuild produced no metafile");
    }

    const leaked = findForbiddenBuiltinImports(result.metafile);
    if (leaked.length > 0) {
      throw new Error(`Bundle leaked Node built-in imports: ${leaked.join(", ")}`);
    }

    reports.push({
      entry: variant.entry,
      minified: variant.minified,
      bytes: output.contents.byteLength,
      gzippedBytes: gzipSync(output.contents).byteLength,
    });
  }

  const report = renderReport(reports);
  const outputPath = resolve(process.cwd(), "docs/benchmarks/bundle-size.md");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, report);
  process.stdout.write(`${report}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

function renderReport(reports: readonly VariantReport[]): string {
  const lines: string[] = [];
  lines.push("# Bundle Size");
  lines.push("");
  lines.push("Esbuild-bundled, worker-target ESM output for the public entry point.");
  lines.push("Verified to contain no Node built-ins from the shared forbidden list (`scripts/bundle-leak-detector.ts`).");
  lines.push("");
  lines.push("| Entry | Minified | Bytes | Gzipped |");
  lines.push("|---|---|---:|---:|");
  for (const report of reports) {
    lines.push(`| \`${report.entry}\` | ${report.minified ? "yes" : "no"} | ${formatBytes(report.bytes)} | ${formatBytes(report.gzippedBytes)} |`);
  }
  lines.push("");
  lines.push(
    "These numbers include the 34-language bundled stopword set. The bundled "
      + "stopword text is the dominant contributor; if a consumer needs a smaller "
      + "edge payload they can ship a single-language `StopwordProvider` and "
      + "tree-shake the rest.",
  );
  lines.push("");
  return lines.join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
