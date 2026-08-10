import { expect, test, type Locator, type Page } from '@playwright/test'

const canvasDigest = async (page: Page) =>
  page.locator('canvas').evaluate(canvas => {
    const context = canvas.getContext('2d')
    if (!context) {
      return 0
    }
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    let hash = 2166136261
    for (let index = 0; index < data.length; index += 4) {
      hash = Math.imul(hash ^ data[index], 16777619)
      hash = Math.imul(hash ^ data[index + 1], 16777619)
      hash = Math.imul(hash ^ data[index + 2], 16777619)
      hash = Math.imul(hash ^ data[index + 3], 16777619)
    }
    return hash >>> 0
  })

const canvasColorCount = async (page: Page) =>
  page.locator('canvas').evaluate(canvas => {
    const context = canvas.getContext('2d')
    if (!context) {
      return 0
    }

    const sample = document.createElement('canvas')
    sample.width = 32
    sample.height = 32
    const sampleContext = sample.getContext('2d')
    if (!sampleContext) {
      return 0
    }

    sampleContext.drawImage(canvas, 0, 0, sample.width, sample.height)
    const data = sampleContext.getImageData(
      0,
      0,
      sample.width,
      sample.height
    ).data
    const colors = new Set<number>()
    for (let index = 0; index < data.length; index += 4) {
      const color =
        (((((data[index] << 8) | data[index + 1]) << 8) | data[index + 2]) <<
          8) |
        data[index + 3]
      colors.add(color >>> 0)
    }
    return colors.size
  })

const commitTextField = async (page: Page, field: Locator, value: string) => {
  await field.fill(value)
  await field.press('Enter')
  await page.waitForTimeout(150)
  await expect(field).toHaveValue(value)
}

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

test('cafe completes the rectangle edit, history, and persistence loop', async ({
  page,
}) => {
  test.setTimeout(45_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect(page.getByText('No selection')).toBeVisible()
  await expect.poll(() => canvasColorCount(page)).toBeGreaterThan(1)

  const sampleDigest = await canvasDigest(page)
  await page.getByRole('button', { name: 'New' }).click()
  await expect.poll(() => canvasDigest(page)).not.toBe(sampleDigest)
  await expect(page.getByText('No selection')).toBeVisible()

  const initialDigest = await canvasDigest(page)
  await page.getByRole('button', { name: 'Rect' }).click()
  const box = await canvas.boundingBox()
  if (!box) {
    throw new Error('Canvas bounds are unavailable')
  }
  const creationStart = {
    x: box.x + box.width * 0.35,
    y: box.y + box.height * 0.35,
  }
  const creationEnd = {
    x: box.x + box.width * 0.48,
    y: box.y + box.height * 0.5,
  }
  const createdCenter = {
    x: (creationStart.x + creationEnd.x) / 2,
    y: (creationStart.y + creationEnd.y) / 2,
  }
  await page.mouse.move(creationStart.x, creationStart.y)
  await page.mouse.down()
  await page.mouse.move(creationEnd.x, creationEnd.y, { steps: 8 })
  await page.mouse.up()

  const name = page.getByLabel('Name')
  const x = page.getByLabel('X')
  const width = page.getByLabel('W', { exact: true })
  const fill = page.getByLabel('Fill')
  await expect(name).toBeVisible()
  await expect.poll(() => canvasDigest(page)).not.toBe(initialDigest)

  const createdX = Number(await x.inputValue())
  await page.getByRole('button', { name: 'Select' }).click()
  await page.mouse.move(createdCenter.x, createdCenter.y)
  await page.mouse.down()
  await page.mouse.move(createdCenter.x + 60, createdCenter.y + 35, {
    steps: 8,
  })
  await page.mouse.up()
  await expect.poll(async () => Number(await x.inputValue())).not.toBe(createdX)
  const draggedX = Number(await x.inputValue())

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => Number(await x.inputValue())).toBe(createdX)
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect.poll(async () => Number(await x.inputValue())).toBe(draggedX)

  await commitTextField(page, name, 'E2E rectangle')
  await commitTextField(page, x, '300')
  await commitTextField(page, width, '180')
  await fill.fill('#22c55e')
  await page.waitForTimeout(150)
  await expect(fill).toHaveValue('#22c55e')

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(fill).toHaveValue('#d9d9d9')
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(fill).toHaveValue('#22c55e')

  await page.getByRole('button', { name: 'Save' }).click()
  const reload = page.getByRole('button', { name: 'Reload' })
  await expect(reload).toBeEnabled()

  await commitTextField(page, x, '500')
  const unsavedDigest = await canvasDigest(page)

  await reload.click()
  await expect(page.getByText('No selection')).toBeVisible()
  await expect.poll(() => canvasDigest(page)).not.toBe(unsavedDigest)
  await page.getByRole('button', { name: 'Select' }).click()
  const reloadedBox = await canvas.boundingBox()
  if (!reloadedBox) {
    throw new Error('Canvas bounds are unavailable after reload')
  }
  await page.mouse.click(
    reloadedBox.x + reloadedBox.width / 2,
    reloadedBox.y + reloadedBox.height / 2
  )
  await expect(name).toHaveValue('E2E rectangle')
  await expect(x).toHaveValue('300')
  await expect(width).toHaveValue('180')
  await expect(fill).toHaveValue('#22c55e')
  expect(errors).toEqual([])
})
