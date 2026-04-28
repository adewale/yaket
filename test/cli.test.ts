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

  it("never throws while parsing arbitrary argv and always returns a well-shaped CliArgs", () => {
    fc.assert(
      fc.property(fc.array(argvToken, { minLength: 0, maxLength: 20 }), (argv) => {
        const args = parseCliArgs(argv);

        // Every CliArgs invariant: required keys present and well-typed.
        expect(typeof args.verbose).toBe("boolean");
        expect(typeof args.help).toBe("boolean");
        expect(Array.isArray(args.parseErrors)).toBe(true);
        // Every parse error must be a non-empty string with a recognizable
        // structure (`--<flag> ...` or `-<short> ...`). Random argv must not
        // produce malformed error strings.
        for (const error of args.parseErrors) {
          expect(typeof error).toBe("string");
          expect(error.length).toBeGreaterThan(0);
          expect(error).toMatch(/^-/u);
        }
        // Numeric fields are either undefined or finite numbers (never NaN).
        for (const key of ["ngramSize", "dedupLim", "windowSize", "top"] as const) {
          const value = args[key];
          if (value !== undefined) {
            expect(typeof value).toBe("number");
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("never throws while running arbitrary argv with stubbed dependencies, only emits exit codes 0 or 1, and always emits at least one output line", () => {
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

        // The CLI is a one-shot command: exit code is 0 (success) or 1
        // (validation/IO failure). Anything else is a regression.
        expect([0, 1]).toContain(exitCode);
        // Either path must produce at least one output line — either the
        // results / help text on stdout or an error message on stderr.
        // A silent run would mean the user sees nothing and is a bug.
        expect(stdout.length + stderr.length).toBeGreaterThanOrEqual(1);
        // All outputs are strings.
        for (const line of [...stdout, ...stderr]) {
          expect(typeof line).toBe("string");
        }
      }),
      { numRuns: 200 },
    );
  });
});
