import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('platform detection across runtimes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('importScripts', undefined)
    vi.stubGlobal('origin', undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('imports the public utilities without a browser navigator', async () => {
    vi.stubGlobal('navigator', undefined)

    const kit = await import('../../index')

    expect(kit.isWeb).toBe(false)
    expect(kit.isWebWorker).toBe(false)
    expect(kit.isChrome).toBe(false)
    expect(kit.isIOS).toBe(false)
    expect(kit.webWorkerOrigin).toBeUndefined()
    expect(new kit.LinkedList().size).toBe(0)
  })

  it('does not treat the Node.js navigator as a browser', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Node.js/22' })

    const platform = await import('../platform')

    expect(platform.isWeb).toBe(false)
    expect(platform.isWebWorker).toBe(false)
  })

  it('preserves Windows Chrome detection in a browser', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
      maxTouchPoints: 0,
    })

    const platform = await import('../platform')

    expect(platform.isWeb).toBe(true)
    expect(platform.isWindows).toBe(true)
    expect(platform.isChrome).toBe(true)
    expect(platform.isSafari).toBe(false)
    expect(platform.isMobile).toBe(false)
  })

  it.each([
    { maxTouchPoints: 0, isIOS: false },
    { maxTouchPoints: 5, isIOS: true },
  ])(
    'distinguishes desktop Safari and touch iPad ($maxTouchPoints)',
    async ({ maxTouchPoints, isIOS }) => {
      vi.stubGlobal('window', {})
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        maxTouchPoints,
      })

      const platform = await import('../platform')

      expect(platform.isMacintosh).toBe(true)
      expect(platform.isSafari).toBe(true)
      expect(platform.isIOS).toBe(isIOS)
    }
  )

  it('detects a browser worker without window', async () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
    })
    vi.stubGlobal('importScripts', () => undefined)
    vi.stubGlobal('origin', 'https://editor.example')

    const platform = await import('../platform')

    expect(platform.isWeb).toBe(true)
    expect(platform.isWebWorker).toBe(true)
    expect(platform.webWorkerOrigin).toBe('https://editor.example')
    expect(platform.isLinux).toBe(true)
  })
})
