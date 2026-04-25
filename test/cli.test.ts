import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { formatCliOutput, helpText, parseCliArgs, runCli, validateCliArgs } from "../src/cli.js";

const argvToken = fc.string({ unit: "grapheme-ascii", minLength: 0, maxLength: 20 });

describe("cli", () => {
  it("parses every supported flag", () => {
    const args = parseCliArgs([
      "--text-input", "hello world",
      "--input-file", "input.txt",
      "--language", "en",
      "--ngram-size", "3",
      "--dedup-func", "seqm",
      "--dedup-lim", "0.9",
      "--window-size", "2",
      "--top", "5",
      "--verbose",
      "--help",
    ]);

    expect(args).toEqual({
      textInput: "hello world",
      inputFile: "input.txt",
      language: "en",
      ngramSize: 3,
      dedupFunc: "seqm",
      dedupLim: 0.9,
      windowSize: 2,
      top: 5,
      verbose: true,
      help: true,
      parseErrors: [],
    });
  });

  it("captures parse errors for missing and invalid numeric values", () => {
    const args = parseCliArgs(["--ngram-size", "oops", "--top"]);
    expect(args.parseErrors).toEqual([
      "--ngram-size must be numeric",
      "--top requires a value",
    ]);
  });

  it("validates logical CLI constraints", () => {
    const args = parseCliArgs(["--text-input", "hello", "--top", "0", "--dedup-lim", "2", "--dedup-func", "wat"]);
    expect(validateCliArgs(args)).toEqual([
      "--top must be a positive integer",
      "--dedup-lim must be between 0 and 1",
      "--dedup-func must be one of levs, jaro, seqm",
    ]);
  });

  it("prints help and returns 0 for --help", () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = runCli(["--help"], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toBe(helpText());
    expect(stderr).toEqual([]);
  });

  it("returns 1 and prints help for invalid args", () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = runCli(["--top", "0"], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toBe(helpText());
    expect(stderr.join("")).toContain("either --text-input or --input-file is required");
    expect(stderr.join("")).toContain("--top must be a positive integer");
  });

  it("reads text input directly and formats plain output", () => {
    const stdout: string[] = [];
    const exitCode = runCli(["--text-input", "hello world"], {
      extract: () => [["hello world", 0.1], ["hello", 0.2]],
      stdout: (message) => stdout.push(message),
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toBe("hello world\nhello\n");
  });

  it("reads from input files and formats verbose output", () => {
    const filePath = join(tmpdir(), `yaket-cli-${Date.now()}.txt`);
    writeFileSync(filePath, "hello from file");

    const stdout: string[] = [];
    const exitCode = runCli(["--input-file", filePath, "--verbose"], {
      extract: () => [["hello from file", 0.1]],
      stdout: (message) => stdout.push(message),
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("hello from file");
    expect(stdout.join("")).toContain("0.1");
  });

  it("uses text input precedence over input files", () => {
    const stdout: string[] = [];
    const exitCode = runCli(["--text-input", "direct text", "--input-file", "ignored.txt"], {
      readFile: () => {
        throw new Error("should not read file");
      },
      extract: (text) => [[text, 0.1]],
      stdout: (message) => stdout.push(message),
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("direct text");
  });

  it("returns 1 for file read failures", () => {
    const stderr: string[] = [];
    const exitCode = runCli(["--input-file", "missing.txt"], {
      readFile: () => {
        throw new Error("ENOENT");
      },
      stdout: () => undefined,
      stderr: (message) => stderr.push(message),
    });

    expect(exitCode).toBe(1);
    expect(stderr.join("")).toContain("failed to read input file");
  });

  it("formats output consistently", () => {
    expect(formatCliOutput([["hello", 0.1]], false)).toBe("hello\n");
    expect(formatCliOutput([["hello", 0.1]], true)).toContain("hello");
  });

  it("never throws while parsing arbitrary argv", () => {
    fc.assert(
      fc.property(fc.array(argvToken, { minLength: 0, maxLength: 20 }), (argv) => {
        const args = parseCliArgs(argv);
        expect(args.parseErrors.length).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });

  it("never throws while running arbitrary argv with stubbed dependencies", () => {
    fc.assert(
      fc.property(fc.array(argvToken, { minLength: 0, maxLength: 20 }), (argv) => {
        const stdout: string[] = [];
        const stderr: string[] = [];

        const exitCode = runCli(argv, {
          readFile: () => "stub",
          extract: () => [],
          stdout: (message) => stdout.push(message),
          stderr: (message) => stderr.push(message),
        });

        expect([0, 1]).toContain(exitCode);
        expect(stdout.length + stderr.length).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });
});
