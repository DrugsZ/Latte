import { expect, test } from '@playwright/test'

test('cafe renders sample document with SharedArrayBuffer enabled', async ({
  page,
}) => {
  test.setTimeout(20_000)
  const pageErrors: string[] = []
  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  const start = performance.now()
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas')
  await page.waitForTimeout(1500)
  const renderMs = performance.now() - start

  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const info = {
      crossOriginIsolated: window.crossOriginIsolated,
      hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      canvasCount: document.querySelectorAll('canvas').length,
      nonBlankPixelCount: 0,
    }

    if (!canvas) {
      return info
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return info
    }

    const sample = document.createElement('canvas')
    sample.width = 64
    sample.height = 64
    const sampleCtx = sample.getContext('2d')
    if (!sampleCtx) {
      return info
    }
    sampleCtx.drawImage(canvas, 0, 0, sample.width, sample.height)

    const data = sampleCtx.getImageData(0, 0, sample.width, sample.height).data
    for (let i = 0; i < data.length; i += 4) {
      if (
        data[i] !== 0 ||
        data[i + 1] !== 0 ||
        data[i + 2] !== 0 ||
        data[i + 3] !== 0
      ) {
        info.nonBlankPixelCount++
      }
    }

    return info
  })

  expect(pageErrors).toEqual([])
  expect(result.crossOriginIsolated).toBe(true)
  expect(result.hasSharedArrayBuffer).toBe(true)
  expect(result.canvasCount).toBe(1)
  expect(result.nonBlankPixelCount).toBeGreaterThan(100)
  expect(renderMs).toBeLessThan(10_000)
})
