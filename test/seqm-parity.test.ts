import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { createKeywordExtractor } from "../src/index.js";

const pythonPath = process.env.YAKET_PYTHONPATH ?? "/tmp/yake";
const hasPythonReference = existsSync(pythonPath);

describe("seqm parity examples", () => {
  it("matches upstream YAKE examples for representative pairs", () => {
    const extractor = createKeywordExtractor({ dedupFunc: "seqm" });

    expect(extractor.seqm("learning deep", "deep learning")).toBe(0);
    expect(extractor.seqm("machine learning", "machine learning")).toBe(1);
    expect(extractor.seqm("agent swarms", "agents")).toBeCloseTo(0.40636363636363637, 14);
    expect(extractor.seqm("google cloud platform", "cloud platform")).toBe(0);
    expect(extractor.seqm("cooperative context aware", "context aware")).toBeCloseTo(0.6666666666666666, 14);
  });

  it.skipIf(!hasPythonReference)("matches upstream seqm on randomized candidate pairs", () => {
    const extractor = createKeywordExtractor({ dedupFunc: "seqm" });
    const pairs = buildSeqmPairs();
    const script = [
      "import json, os, sys",
      "sys.path.insert(0, os.environ.get('YAKET_PYTHONPATH', '/tmp/yake'))",
      "import yake",
      "pairs = json.loads(os.environ['YAKET_SEQM_PAIRS'])",
      "extractor = yake.KeywordExtractor(dedup_func='seqm')",
      "for left, right in pairs:",
      "    print(json.dumps(extractor.seqm(left, right)))",
    ].join("\n");

    const execution = spawnSync("python3", ["-c", script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        YAKET_PYTHONPATH: pythonPath,
        YAKET_SEQM_PAIRS: JSON.stringify(pairs),
      },
      encoding: "utf8",
    });

    if (execution.status !== 0) {
      throw new Error(execution.stderr || "Python seqm parity run failed");
    }

    const pythonScores = execution.stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as number);
    expect(pythonScores).toHaveLength(pairs.length);

    for (let index = 0; index < pairs.length; index += 1) {
      const [left, right] = pairs[index]!;
      expect(extractor.seqm(left, right)).toBeCloseTo(pythonScores[index]!, 14);
    }
  });
});

function buildSeqmPairs(): Array<[string, string]> {
  const seedPairs: Array<[string, string]> = [
    ["jeremie miller", "miller"],
    ["google cloud platform", "cloud platform"],
    ["vertical ai", "enterprise ai"],
    ["你好……再见", "你好世界"],
    ["emoji 🙂 launcher", "emoji launcher"],
  ];
  const fragments = [
    "agent", "agents", "swarm", "swarms", "platform", "platforms", "cloud", "google", "kaggle",
    "learning", "machine", "data", "science", "vertical", "enterprise", "🙂", "你好", "مرحبا",
  ];

  for (let index = 0; index < fragments.length - 2; index += 1) {
    seedPairs.push([
      `${fragments[index]} ${fragments[index + 1]} ${fragments[index + 2]}`,
      `${fragments[index + 1]} ${fragments[index + 2]}`,
    ]);
    seedPairs.push([
      `${fragments[index]}-${fragments[index + 1]}`,
      `${fragments[index]} ${fragments[index + 1]}`,
    ]);
  }

  return seedPairs;
}
