#!/usr/bin/env node

import { readFileSync } from "node:fs";

import { extractKeywords } from "./KeywordExtractor.js";

interface CliArgs {
  textInput?: string;
  inputFile?: string;
  language?: string;
  ngramSize?: number;
  dedupFunc?: string;
  dedupLim?: number;
  windowSize?: number;
  top?: number;
  verbose: boolean;
  help: boolean;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || (!args.textInput && !args.inputFile)) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const text = args.textInput ?? readFileSync(args.inputFile!, "utf8");
  const keywords = extractKeywords(text, {
    lan: args.language,
    n: args.ngramSize,
    dedupFunc: args.dedupFunc,
    dedupLim: args.dedupLim,
    windowSize: args.windowSize,
    top: args.top,
  });

  if (args.verbose) {
    process.stdout.write(`${JSON.stringify(keywords, null, 2)}\n`);
  } else {
    process.stdout.write(`${keywords.map(([keyword]) => keyword).join("\n")}\n`);
  }
}

function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = {
    verbose: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const next = argv[index + 1];

    switch (arg) {
      case "-ti":
      case "--text-input":
        result.textInput = next;
        index += 1;
        break;
      case "-i":
      case "--input-file":
        result.inputFile = next;
        index += 1;
        break;
      case "-l":
      case "--language":
        result.language = next;
        index += 1;
        break;
      case "-n":
      case "--ngram-size":
        result.ngramSize = Number(next);
        index += 1;
        break;
      case "-df":
      case "--dedup-func":
        result.dedupFunc = next;
        index += 1;
        break;
      case "-dl":
      case "--dedup-lim":
        result.dedupLim = Number(next);
        index += 1;
        break;
      case "-ws":
      case "--window-size":
        result.windowSize = Number(next);
        index += 1;
        break;
      case "-t":
      case "--top":
        result.top = Number(next);
        index += 1;
        break;
      case "-v":
      case "--verbose":
        result.verbose = true;
        break;
      case "--help":
        result.help = true;
        break;
    }
  }

  return result;
}

function printHelp(): void {
  process.stdout.write(`Usage: yaket [OPTIONS]\n\nOptions:\n  -ti, --text-input TEXT     Input text\n  -i, --input-file TEXT      Input file\n  -l, --language TEXT        Language\n  -n, --ngram-size INTEGER   Max size of the ngram\n  -df, --dedup-func TEXT     Deduplication function (leve|jaro|seqm)\n  -dl, --dedup-lim FLOAT     Deduplication limit\n  -ws, --window-size INT     Window size\n  -t, --top INTEGER          Number of keywords to extract\n  -v, --verbose              Print keyword-score pairs as JSON\n  --help                     Show this message\n`);
}
