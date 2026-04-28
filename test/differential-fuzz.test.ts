import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { KeywordExtractor } from "../src/index.js";
import { referenceCases } from "./fixtures/reference.js";

const pythonPath = process.env.YAKET_PYTHONPATH ?? "/tmp/yake";
const hasPythonReference = existsSync(pythonPath);

describe.skipIf(!hasPythonReference)("differential fuzzing against Python YAKE", () => {
  it("matches Python YAKE on mutated English fixtures with Unicode and long-text perturbations", () => {
    const samples = buildMutatedSamples();
    const script = [
      "import json, os, yake",
      "samples = json.loads(os.environ['YAKET_MUTATED_SAMPLES'])",
      "for sample in samples:",
      "    result = yake.KeywordExtractor(**sample['options']).extract_keywords(sample['text'])",
      "    print(json.dumps({'name': sample['name'], 'result': result}, ensure_ascii=False))",
    ].join("\n");

    const execution = spawnSync("python3", ["-c", script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONPATH: pythonPath,
        YAKET_MUTATED_SAMPLES: JSON.stringify(samples.map((sample) => ({
          name: sample.name,
          text: sample.text,
          // Python YAKE's keyword arguments use snake_case, so we translate
          // the Yaket camelCase options here. Yaket itself only accepts the
          // canonical names.
          options: {
            lan: sample.options.language ?? "en",
            n: sample.options.n ?? 3,
            top: sample.options.top ?? 10,
            dedup_lim: sample.options.dedupLim ?? 0.9,
            dedup_func: sample.options.dedupFunc ?? "seqm",
            window_size: sample.options.windowSize ?? 1,
          },
        }))),
      },
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });

    if (execution.status !== 0) {
      throw new Error(execution.stderr || "Python differential fuzz run failed");
    }

    const pythonResults = new Map<string, Array<[string, number]>>();
    for (const line of execution.stdout.trim().split("\n").filter(Boolean)) {
      const parsed = JSON.parse(line) as { name: string; result: Array<[string, number]> };
      pythonResults.set(parsed.name, parsed.result);
    }

    for (const sample of samples) {
      const actual = new KeywordExtractor(sample.options).extractKeywords(sample.text).map(([keyword, score]) => [keyword.toLowerCase(), score] as const);
      const python = pythonResults.get(sample.name);

      expect(python, `missing python result for ${sample.name}`).toBeDefined();
      expect(actual).toHaveLength(python!.length);

      for (let index = 0; index < python!.length; index += 1) {
        expect(actual[index]![0]).toBe(python![index]![0].toLowerCase());
        expect(Math.abs(actual[index]![1] - python![index]![1])).toBeLessThanOrEqual(1e-12);
      }
    }
  });
});

function buildMutatedSamples() {
  const baseFixtures = referenceCases.filter((fixture) => fixture.options.language === "en" && fixture.name !== "english-special-characters");
  const mutations = [
    { suffix: ' "quoted…"', tag: "quotes-ellipsis" },
    { suffix: " Emoji 🙂 rocket 🚀", tag: "emoji" },
    { suffix: " 你好世界 再见世界", tag: "cjk" },
    { suffix: " مرحبا بالعالم؟", tag: "arabic" },
    { suffix: ` ${Array.from({ length: 40 }, () => "data science machine learning").join(" ")}`, tag: "long-tail" },
  ];

  return baseFixtures.flatMap((fixture) => mutations.map((mutation) => ({
    name: `${fixture.name}-${mutation.tag}`,
    text: `${fixture.text}${mutation.suffix}`,
    options: { ...fixture.options },
  })));
}
