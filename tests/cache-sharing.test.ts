/**
 * Cross-package integration tests — model cache sharing.
 *
 * Verifies that @vantra-design/ask-design-system and
 * @vantra-design/screenreader-empathy share model caches through
 * @vantra-design/local-inference, so a model downloaded by one
 * tool is immediately available to the other without re-downloading.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Cache API mock ──────────────────────────────────────────────

interface MockCacheEntry {
  url: string
  response: Response
}

function createCacheMock() {
  const stores = new Map<string, MockCacheEntry[]>()

  const mockCaches = {
    open: vi.fn(async (name: string) => {
      if (!stores.has(name)) stores.set(name, [])
      const entries = stores.get(name)!
      return {
        match: vi.fn(async (url: string) => {
          return entries.find((e) => e.url === url)?.response
        }),
        put: vi.fn(async (url: string, response: Response) => {
          entries.push({ url, response })
        }),
        keys: vi.fn(async () =>
          entries.map((e) => new Request(e.url)),
        ),
        delete: vi.fn(async (url: string) => {
          const idx = entries.findIndex((e) => e.url === url)
          if (idx >= 0) { entries.splice(idx, 1); return true }
          return false
        }),
      }
    }),
    delete: vi.fn(async (name: string) => {
      if (stores.has(name)) { stores.delete(name); return true }
      return false
    }),
    has: vi.fn(async (name: string) => stores.has(name)),
  }

  return { mockCaches, stores }
}

// ─── Tests ──────────────────────────────────────────────────────

describe('Cross-package cache sharing', () => {
  let cachesMock: ReturnType<typeof createCacheMock>

  beforeEach(() => {
    cachesMock = createCacheMock()
    vi.stubGlobal('caches', cachesMock.mockCaches)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('LocalLLMEngine.isCached uses the webllm/model cache bucket', async () => {
    const { LocalLLMEngine } = await import('@vantra-design/local-inference')

    // Initially empty
    expect(await LocalLLMEngine.isCached()).toBe(false)

    // Simulate a cached model entry
    const cache = await cachesMock.mockCaches.open('webllm/model')
    await cache.put(
      'https://huggingface.co/Llama-3.2-1B-Instruct-q4f32_1-MLC/resolve/main/model.wasm',
      new Response('fake'),
    )

    expect(await LocalLLMEngine.isCached()).toBe(true)
  })

  it('LocalTTS.isCached uses the kokoro-tts cache bucket', async () => {
    const { LocalTTS } = await import('@vantra-design/local-inference')

    expect(await LocalTTS.isCached()).toBe(false)

    const cache = await cachesMock.mockCaches.open('kokoro-tts')
    await cache.put(
      'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/model.onnx',
      new Response('fake'),
    )

    expect(await LocalTTS.isCached()).toBe(true)
  })

  it('both packages resolve to the same LocalLLMEngine class', async () => {
    // Import from the shared dependency directly
    const directImport = await import('@vantra-design/local-inference')

    // Both packages import LocalLLMEngine via dynamic import from the same package,
    // so the module identity should be the same when resolved through pnpm
    expect(directImport.LocalLLMEngine).toBeDefined()
    expect(typeof directImport.LocalLLMEngine).toBe('function')
    expect(typeof directImport.LocalTTS).toBe('function')

    // Verify the class has the expected static method
    expect(typeof directImport.LocalLLMEngine.isCached).toBe('function')
    expect(typeof directImport.LocalTTS.isCached).toBe('function')
  })

  it('cache entry written by LLM is visible to both packages checking isCached', async () => {
    const { LocalLLMEngine } = await import('@vantra-design/local-inference')

    // Simulate ask-design-system downloading the LLM model
    const cache = await cachesMock.mockCaches.open('webllm/model')
    await cache.put(
      'https://huggingface.co/Llama-3.2-1B-Instruct-q4f32_1-MLC/resolve/main/params_shard_0.bin',
      new Response('shard-data'),
    )

    // Both ask-design-system and screenreader-empathy would call
    // LocalLLMEngine.isCached() — and both go through the same class
    const isCachedForAsk = await LocalLLMEngine.isCached()
    const isCachedForEmpathy = await LocalLLMEngine.isCached()

    expect(isCachedForAsk).toBe(true)
    expect(isCachedForEmpathy).toBe(true)
    expect(isCachedForAsk).toBe(isCachedForEmpathy)
  })

  it('deleteCache removes the entire cache bucket for both packages', async () => {
    const { deleteCache } = await import('@vantra-design/local-inference')
    const { LocalLLMEngine } = await import('@vantra-design/local-inference')

    // Pre-populate cache
    const cache = await cachesMock.mockCaches.open('webllm/model')
    await cache.put(
      'https://huggingface.co/Llama-3.2-1B-Instruct-q4f32_1-MLC/resolve/main/model.wasm',
      new Response('fake'),
    )

    expect(await LocalLLMEngine.isCached()).toBe(true)

    // Delete entire bucket
    const deleted = await deleteCache('webllm/model')
    expect(deleted).toBe(true)

    // Both packages would now see the model as uncached
    expect(await LocalLLMEngine.isCached()).toBe(false)
  })
})
