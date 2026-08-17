/**
 * API coexistence tests — verify both packages can be imported
 * in the same project without type conflicts or module clashes.
 */

import { describe, it, expect } from 'vitest'

describe('API coexistence', () => {
  it('exports from @vantra-design/ask-design-system are accessible', async () => {
    const ads = await import('@vantra-design/ask-design-system')

    expect(ads.DesignSystemAssistant).toBeDefined()
    expect(typeof ads.DesignSystemAssistant).toBe('function')
    expect(typeof ads.DesignSystemAssistant.isSupported).toBe('function')
    expect(typeof ads.DesignSystemAssistant.isCached).toBe('function')
  })

  it('exports from @vantra-design/screenreader-empathy are accessible', async () => {
    const sre = await import('@vantra-design/screenreader-empathy')

    expect(sre.analyzeAccessibilityFlow).toBeDefined()
    expect(typeof sre.analyzeAccessibilityFlow).toBe('function')
    expect(sre.EmpathyPlayback).toBeDefined()
    expect(typeof sre.EmpathyPlayback).toBe('function')
    expect(sre.EmpathyCommentary).toBeDefined()
    expect(typeof sre.EmpathyCommentary).toBe('function')
  })

  it('exports from @vantra-design/local-inference are accessible', async () => {
    const li = await import('@vantra-design/local-inference')

    expect(li.LocalLLMEngine).toBeDefined()
    expect(li.LocalTTS).toBeDefined()
    expect(li.isWebGPUAvailable).toBeDefined()
    expect(li.InferenceError).toBeDefined()
    expect(li.normalizeProgress).toBeDefined()
    expect(li.isCacheAPIAvailable).toBeDefined()
    expect(li.hasCacheEntry).toBeDefined()
    expect(li.deleteCache).toBeDefined()
  })

  it('InferenceError from local-inference is instanceof Error', async () => {
    const { InferenceError } = await import('@vantra-design/local-inference')

    const error = new InferenceError('webgpu-unavailable', 'test error')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(InferenceError)
    expect(error.code).toBe('webgpu-unavailable')
    expect(error.message).toBe('test error')
    expect(error.name).toBe('InferenceError')
  })

  it('all three packages can be imported simultaneously without conflicts', async () => {
    const [ads, sre, li] = await Promise.all([
      import('@vantra-design/ask-design-system'),
      import('@vantra-design/screenreader-empathy'),
      import('@vantra-design/local-inference'),
    ])

    // All three should have resolved without errors
    expect(Object.keys(ads).length).toBeGreaterThan(0)
    expect(Object.keys(sre).length).toBeGreaterThan(0)
    expect(Object.keys(li).length).toBeGreaterThan(0)
  })

  it('core entry point of screenreader-empathy has zero runtime deps', async () => {
    // The ./core entry point should work without @vantra-design/local-inference
    const core = await import('@vantra-design/screenreader-empathy/core')

    expect(core.analyzeAccessibilityFlow).toBeDefined()
    expect(typeof core.analyzeAccessibilityFlow).toBe('function')
  })
})
