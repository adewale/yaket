import { existsSync } from "node:fs";

/**
 * Location of the upstream Python YAKE checkout used as the parity oracle.
 * CI prepares it with scripts/setup-python-parity.sh (pinned commit).
 */
export const pythonPath = process.env["YAKET_PYTHONPATH"] ?? "/tmp/yake";

/** Whether the upstream Python YAKE checkout is available. */
export const hasPythonReference = existsSync(pythonPath);

// Locally the Python-gated tests skip when there is no checkout. The
// python-parity CI lane sets YAKET_REQUIRE_PYTHON_REFERENCE=1, so a missing
// checkout fails the lane instead of silently skipping every parity test.
if (process.env["YAKET_REQUIRE_PYTHON_REFERENCE"] === "1" && !hasPythonReference) {
  throw new Error(
    `YAKET_REQUIRE_PYTHON_REFERENCE=1 but there is no upstream YAKE checkout at ${pythonPath}; run scripts/setup-python-parity.sh`,
  );
}
