import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { KeywordExtractor } from "../src/index.js";
import { referenceCases } from "./fixtures/reference.js";
import { parseNamedPythonKeywordResult } from "./helpers/python-output.js";

const pythonPath = process.env["YAKET_PYTHONPATH"] ?? "/tmp/yake";
const hasPythonReference = existsSync(pythonPath);

describe.skipIf(!hasPythonReference)("python parity", () => {
  it("matches upstream YAKE on frozen samples", () => {
    const script = [
      "import json, os, yake",
      "samples = json.loads(os.environ['YAKET_SAMPLES'])",
      "for sample in samples:",
      "    opts = sample['options']",
      "    result = yake.KeywordExtractor(**opts).extract_keywords(sample['text'])",
      "    print(json.dumps({'name': sample['name'], 'result': result}, ensure_ascii=False))",
    ].join("\n");

    // Python YAKE keyword arguments use snake_case; translate the Yaket
    // canonical option names here for the Python-side call.
    const pythonSamples = referenceCases.map((fixture) => ({
      name: fixture.name,
      text: fixture.text,
      options: {
        lan: fixture.options.language ?? "en",
        n: fixture.options.n ?? 3,
        top: fixture.options.top ?? 20,
        dedup_lim: fixture.options.dedupLim ?? 0.9,
        dedup_func: fixture.options.dedupFunc ?? "seqm",
        window_size: fixture.options.windowSize ?? 1,
      },
    }));

    const execution = spawnSync("python3", ["-c", script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONPATH: pythonPath,
        YAKET_SAMPLES: JSON.stringify(pythonSamples),
      },
      encoding: "utf8",
    });

    if (execution.status !== 0) {
      throw new Error(execution.stderr || "Python parity run failed");
    }

    const pythonResults = new Map<string, Array<[string, number]>>();
    for (const line of execution.stdout.trim().split("\n").filter(Boolean)) {
      const parsed = parseNamedPythonKeywordResult(line);
      pythonResults.set(parsed.name, parsed.result);
    }

    for (const fixture of referenceCases) {
      const actual = new KeywordExtractor(fixture.options).extractKeywords(fixture.text);
      const python = pythonResults.get(fixture.name);

      expect(python, `missing python result for ${fixture.name}`).toBeDefined();
      expect(actual).toHaveLength(python!.length);

      for (let index = 0; index < python!.length; index += 1) {
        expect(actual[index]![0]).toBe(python![index]![0]);
        expect(Math.abs(actual[index]![1] - python![index]![1])).toBeLessThanOrEqual(1e-12);
      }
    }
  });
});
