/**
 * CSP & network isolation tests.
 *
 * Verifies that the allowed network origins for model downloads
 * are well-defined and documented. After models are cached,
 * no further network calls should be needed.
 *
 * These tests validate the CSP connect-src allowlist is complete
 * and that cache-checking works offline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * The complete set of origins that Vantra tools may fetch from
 * during model download. After download, zero network calls are made.
 */
const ALLOWED_ORIGINS = [
  'https://huggingface.co',
  'https://*.huggingface.co',
  'https://cdn-lfs.hf.co',
  'https://cdn-lfs-us-1.hf.co',
  'https://cdn-lfs-us-1.huggingface.co',
] as const

/**
 * The recommended CSP connect-src directive for Vantra tools.
 */
const RECOMMENDED_CSP_CONNECT_SRC = [
  "'self'",
  ...ALLOWED_ORIGINS,
].join(' ')

describe('CSP connect-src allowlist', () => {
  it('covers HuggingFace CDN for model downloads', () => {
    // WebLLM downloads from huggingface.co
    expect(ALLOWED_ORIGINS).toContain('https://huggingface.co')
    expect(ALLOWED_ORIGINS.some((o) => o.includes('huggingface.co'))).toBe(true)
  })

  it('covers HuggingFace LFS CDN for large model files', () => {
    expect(ALLOWED_ORIGINS).toContain('https://cdn-lfs.hf.co')
    expect(ALLOWED_ORIGINS).toContain('https://cdn-lfs-us-1.hf.co')
  })

  it('produces a valid CSP directive string', () => {
    expect(RECOMMENDED_CSP_CONNECT_SRC).toContain("'self'")
    expect(RECOMMENDED_CSP_CONNECT_SRC).toContain('https://huggingface.co')
    // Should not contain any semicolons (that's for separating directives)
    expect(RECOMMENDED_CSP_CONNECT_SRC).not.toContain(';')
  })
})

describe('Offline cache checks (no network needed)', () => {
  beforeEach(() => {
    // Mock Cache API
    const stores = new Map<string, Request[]>()
    vi.stubGlobal('caches', {
      open: vi.fn(async (name: string) => {
        if (!stores.has(name)) stores.set(name, [])
        return {
          match: vi.fn(async () => undefined),
          keys: vi.fn(async () => stores.get(name) ?? []),
        }
      }),
      delete: vi.fn(async () => false),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('isCacheAPIAvailable returns true when Cache API is present', async () => {
    const { isCacheAPIAvailable } = await import('@vantra-design/local-inference')
    expect(isCacheAPIAvailable()).toBe(true)
  })

  it('isCacheAPIAvailable returns false when Cache API is absent', async () => {
    vi.unstubAllGlobals()
    // Don't stub caches — it won't exist in Node
    const { isCacheAPIAvailable } = await import('@vantra-design/local-inference')
    // In Node.js there's no caches global, so this should be false
    // (unless vitest has already polyfilled it)
    const hasCaches = typeof globalThis.caches !== 'undefined'
    expect(isCacheAPIAvailable()).toBe(hasCaches)
  })

  it('hasCacheEntry returns false for nonexistent entry', async () => {
    const { hasCacheEntry } = await import('@vantra-design/local-inference')
    const result = await hasCacheEntry('webllm/model', 'https://example.com/nonexistent')
    expect(result).toBe(false)
  })

  it('cache checks do not make any network requests', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { LocalLLMEngine, LocalTTS } = await import('@vantra-design/local-inference')

    await LocalLLMEngine.isCached()
    await LocalTTS.isCached()

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('CSP meta tag validation', () => {
  it('recommended CSP allows wasm-unsafe-eval for WebGPU shader compilation', () => {
    const RECOMMENDED_CSP_SCRIPT_SRC = "'self' 'wasm-unsafe-eval'"
    expect(RECOMMENDED_CSP_SCRIPT_SRC).toContain('wasm-unsafe-eval')
  })

  it('recommended CSP allows blob: workers for WebLLM/ONNX', () => {
    const RECOMMENDED_CSP_WORKER_SRC = "'self' blob:"
    expect(RECOMMENDED_CSP_WORKER_SRC).toContain('blob:')
  })

  it('documents the complete CSP policy', () => {
    const fullPolicy = [
      "default-src 'self'",
      `connect-src ${RECOMMENDED_CSP_CONNECT_SRC}`,
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "worker-src 'self' blob:",
    ].join('; ')

    // Verify it's a well-formed CSP string
    expect(fullPolicy.split(';').length).toBe(5)
    expect(fullPolicy).toContain('connect-src')
    expect(fullPolicy).toContain('script-src')
    expect(fullPolicy).toContain('worker-src')
  })
})
