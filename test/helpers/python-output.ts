export type PythonKeywordResult = Array<[string, number]>;

export interface NamedPythonKeywordResult {
  name: string;
  result: PythonKeywordResult;
}

export function parseNamedPythonKeywordResult(line: string): NamedPythonKeywordResult {
  const parsed = JSON.parse(line) as unknown;
  if (!isNamedPythonKeywordResult(parsed)) {
    throw new TypeError(`Invalid Python keyword result: ${line}`);
  }
  return parsed;
}

export function parsePythonNumber(line: string): number {
  const parsed = JSON.parse(line) as unknown;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
    throw new TypeError(`Invalid Python numeric result: ${line}`);
  }
  return parsed;
}

function isNamedPythonKeywordResult(value: unknown): value is NamedPythonKeywordResult {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const candidate = value as { name?: unknown; result?: unknown };
  return typeof candidate.name === "string" && isPythonKeywordResult(candidate.result);
}

function isPythonKeywordResult(value: unknown): value is PythonKeywordResult {
  return Array.isArray(value) && value.every((item) => (
    Array.isArray(item)
    && item.length === 2
    && typeof item[0] === "string"
    && typeof item[1] === "number"
    && Number.isFinite(item[1])
  ));
}
