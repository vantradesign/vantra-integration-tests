# vantra-integration-tests

Cross-package integration tests for the [Vantra](https://vantra.design) tool suite.

## What's tested

| Suite | Tests | Verifies |
| --- | --- | --- |
| `cache-sharing` | 5 | Both packages share the same Cache API buckets via `@vantra-design/local-inference`; download once, both tools use it |
| `api-coexistence` | 6 | All three packages import without conflicts; public APIs are accessible; `./core` entry point works standalone |
| `csp-network` | 10 | CSP `connect-src` allowlist covers all model download origins; cache checks work offline with zero network calls |

## Running

```bash
pnpm install
pnpm test
```

Requires built `dist/` in all three linked packages. From the VANTRA root:

```bash
cd vantra-local-inference  && pnpm run build && cd ..
cd vantra-screenreader-empathy && pnpm run build && cd ..
cd vantra-ask-design-system && pnpm run build && cd ..
cd vantra-integration-tests && pnpm test
```

## Recommended CSP policy

For sites that embed both Vantra tools, use this Content-Security-Policy:

```txt
default-src 'self';
connect-src 'self' https://huggingface.co https://*.huggingface.co https://cdn-lfs.hf.co https://cdn-lfs-us-1.hf.co https://cdn-lfs-us-1.huggingface.co;
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
worker-src 'self' blob:;
```

After the one-time model download, **zero network calls** are made. All inference runs locally via WebGPU.
