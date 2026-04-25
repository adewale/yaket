import { Buffer } from "node:buffer";

import { build } from "esbuild";
import { describe, expect, it } from "vitest";

describe("worker smoke", () => {
  it("bundles and executes in a browser-style module target", async () => {
    const result = await build({
      stdin: {
        contents: `
          import { extractKeywords, extractFromDocument, extractYakeKeywords } from "./src/index.ts";

          const keywords = extractKeywords("Cloudflare Workers process requests at the edge.", { language: "en", top: 5, n: 2 });
          const bobbin = extractYakeKeywords("Keyword extraction powers topic ranking.", 5, 2);
          const document = extractFromDocument({ id: "edge-doc", body: "Workers run code close to users.", language: "en" });

          export default { keywords, bobbin, document };
        `,
        resolveDir: process.cwd(),
        sourcefile: "worker-smoke-entry.ts",
      },
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      write: false,
    });

    const code = result.outputFiles[0]!.text;
    expect(code).not.toContain("node:fs");
    expect(code).not.toContain("child_process");
    expect(code).not.toContain("node:path");

    const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
    const module = await import(moduleUrl);

    expect(module.default.keywords[0][0]).toBe("Cloudflare Workers");
    expect(module.default.bobbin[0].keyword).toBe("keyword extraction");
    expect(module.default.document.id).toBe("edge-doc");
    expect(module.default.document.keywords[0].normalizedKeyword).toBe("workers run code");
  });
});
