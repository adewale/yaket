# Bundle Size

Esbuild-bundled, worker-target ESM output for the public entry point.
Verified to contain no Node built-ins (`fs`, `path`, `child_process`, `os`).

| Entry | Minified | Bytes | Gzipped |
|---|---|---:|---:|
| `src/index.ts` | yes | 151.5 KiB | 43.8 KiB |
| `src/index.ts` | no | 187.9 KiB | 48.2 KiB |

These numbers include the 34-language bundled stopword set. The bundled stopword text is the dominant contributor; if a consumer needs a smaller edge payload they can ship a single-language `StopwordProvider` and tree-shake the rest.
