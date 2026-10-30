import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('console', message => {
    if (message.type() === 'error') console.error(message.text())
  })
})

async function save(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByTestId('save-document').click()
  const path = await (await download).path()
  return JSON.parse(await readFile(path!, 'utf8'))
}

async function createRectangle(page: Page) {
  await page.getByTestId('rectangle-tool').click()
  const box = (await page.locator('canvas').boundingBox())!
  const point = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.4 }
  await page.mouse.click(point.x, point.y)
  await expect(page.getByTestId('selection-count')).toHaveText('Selected: 1')
  await expect(page.getByTestId('selected-id')).toContainText('rectangle:')
  return point
}

async function property(page: Page, key: string, value: string) {
  const input = page.getByTestId(`property-${key}`)
  await input.fill(value)
  await input.press('Enter')
  await expect(page.locator('.workspace')).toHaveAttribute('data-busy', 'false')
  await expect(page.getByRole('alert')).toHaveCount(0)
}

test('toolbar actions preserve a property draft committed by blur', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await createRectangle(page)
  const id = (await page.getByTestId('selected-id').textContent())!

  await page.getByTestId('property-name').fill('Saved directly from a draft')
  const saved = await save(page)
  expect(
    saved.elements.find((node: { guid: string }) => node.guid === id).name
  ).toBe('Saved directly from a draft')

  await page.getByTestId('property-name').fill('Undo this draft')
  await page.getByTestId('undo').click()
  await expect(page.getByTestId('property-name')).toHaveValue(
    'Saved directly from a draft'
  )
  await expect(page.getByTestId('selected-id')).toHaveText(id)
  expect(errors).toEqual([])
})

test('single-document edit loop preserves worker edits, history and saved files', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByTestId('rectangle-tool')).toBeEnabled()
  await expect(page.getByTestId('undo')).toBeDisabled()
  const initial = await save(page)
  const point = await createRectangle(page)
  const id = (await page.getByTestId('selected-id').textContent())!

  // A creation is one user history entry, including attachment to the page.
  await page.getByTestId('undo').click()
  await expect(page.getByTestId('selection-count')).toHaveText('Selected: 0')
  expect((await save(page)).elements).toHaveLength(initial.elements.length)
  await page.getByTestId('redo').click()
  await page.getByTestId('select-tool').click()
  await page.mouse.click(point.x + 18, point.y + 18)
  await expect(page.getByTestId('selected-id')).toHaveText(id)
  const beforeX = Number(await page.getByTestId('property-x').inputValue())
  const beforeY = Number(await page.getByTestId('property-y').inputValue())

  await page.mouse.move(point.x + 18, point.y + 18)
  await page.mouse.down()
  await page.mouse.move(point.x + 58, point.y + 48, { steps: 5 })
  await page.mouse.up()
  await expect
    .poll(async () => Number(await page.getByTestId('property-x').inputValue()))
    .not.toBe(beforeX)
  const movedX = Number(await page.getByTestId('property-x').inputValue())
  const movedY = Number(await page.getByTestId('property-y').inputValue())
  await page.getByTestId('undo').click()
  await expect
    .poll(async () => Number(await page.getByTestId('property-x').inputValue()))
    .toBeCloseTo(beforeX, 3)
  await expect
    .poll(async () => Number(await page.getByTestId('property-y').inputValue()))
    .toBeCloseTo(beforeY, 3)
  await page.getByTestId('redo').click()
  await expect
    .poll(async () => Number(await page.getByTestId('property-x').inputValue()))
    .toBeCloseTo(movedX, 3)
  await expect
    .poll(async () => Number(await page.getByTestId('property-y').inputValue()))
    .toBeCloseTo(movedY, 3)

  await property(page, 'name', 'Review rectangle')
  await property(page, 'x', '180')
  await property(page, 'y', '140')
  await property(page, 'width', '160')
  await property(page, 'height', '90')
  await property(page, 'fill', '#3366cc')
  await property(page, 'opacity', '0.6')
  await page.getByTestId('undo').click()
  await expect(page.getByTestId('property-opacity')).toHaveValue('1')
  await page.getByTestId('redo').click()
  await expect(page.getByTestId('property-opacity')).toHaveValue('0.6')

  const saved = await save(page)
  const node = saved.elements.find((node: { guid: string }) => node.guid === id)
  expect(node).toMatchObject({
    name: 'Review rectangle',
    size: { x: 160, y: 90 },
    transform: [1, 0, 0, 1, 180, 140],
    fillPaints: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 1 } }],
  })
  expect(node.opacity).toBeCloseTo(0.6)
  await createRectangle(page)
  expect((await save(page)).elements).toHaveLength(saved.elements.length + 1)

  await page.getByTestId('document-file').setInputFiles({
    name: 'saved.latte.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(saved)),
  })
  await expect(page.getByTestId('undo')).toBeDisabled()
  await expect(page.getByTestId('save-document')).toBeEnabled()
  await expect(page.getByTestId('selection-count')).toHaveText('Selected: 0')
  const restored = await save(page)
  expect(restored).toEqual(saved)

  // Reopening does not append another copy or retain post-save nodes.
  await page.getByTestId('document-file').setInputFiles({
    name: 'saved-again.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(saved)),
  })
  await expect(page.getByTestId('save-document')).toBeEnabled()
  expect(await save(page)).toEqual(saved)
  await page.screenshot({
    path: 'test-results/editor-loop.png',
    fullPage: true,
  })
  expect(errors).toEqual([])
})

test('invalid import and property input keep the current document usable', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('rectangle-tool')).toBeEnabled()
  await createRectangle(page)
  const before = await save(page)
  await page.getByTestId('document-file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"elements":[]}'),
  })
  await expect(page.getByRole('alert')).toContainText('document root')
  expect(await save(page)).toEqual(before)
  await page.getByTestId('property-opacity').fill('2')
  await page.getByTestId('property-opacity').press('Enter')
  await expect(page.getByRole('alert')).toContainText('Opacity')
  expect(await save(page)).toEqual(before)
  await property(page, 'name', 'Still editable')
  expect(
    (await save(page)).elements.some(
      (node: { name: string }) => node.name === 'Still editable'
    )
  ).toBe(true)
})

test('layer opacity affects rendered pixels and undo restores the appearance', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('save-document')).toBeEnabled()
  const fixture = {
    elements: [
      { type: 'DOCUMENT', guid: 'pixel:document', name: 'Pixels' },
      {
        type: 'CANVAS',
        guid: 'pixel:page',
        name: 'Page',
        parentIndex: { guid: 'pixel:document', position: '1' },
      },
      {
        type: 'RECTANGLE',
        guid: 'pixel:rect',
        name: 'Red',
        parentIndex: { guid: 'pixel:page', position: '1' },
        transform: [1, 0, 0, 1, 0, 0],
        size: { x: 100, y: 100 },
        fillPaints: [
          {
            type: 'SOLID',
            visible: true,
            opacity: 1,
            blendMode: 0,
            color: { r: 1, g: 0, b: 0, a: 1 },
          },
        ],
      },
    ],
  }
  await page.getByTestId('document-file').setInputFiles({
    name: 'pixels.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  })
  await expect(page.getByTestId('save-document')).toBeEnabled()
  expect(
    (await save(page)).elements.some(
      (node: { guid: string }) => node.guid === 'pixel:rect'
    )
  ).toBe(true)
  const canvas = page.locator('canvas')
  const box = (await canvas.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.getByTestId('selected-id')).toHaveText('pixel:rect')
  const alpha = () =>
    canvas.evaluate(canvas => {
      const surface = canvas as HTMLCanvasElement
      return surface
        .getContext('2d')!
        .getImageData(
          Math.floor(surface.width / 2),
          Math.floor(surface.height / 2),
          1,
          1
        ).data[3]
    })
  await expect.poll(alpha).toBe(255)
  await property(page, 'opacity', '0.5')
  await expect.poll(alpha).toBeGreaterThanOrEqual(127)
  await expect.poll(alpha).toBeLessThanOrEqual(128)
  await property(page, 'opacity', '0')
  await expect.poll(alpha).toBe(0)
  await page.getByTestId('undo').click()
  await expect.poll(alpha).toBeGreaterThanOrEqual(127)
  await expect.poll(alpha).toBeLessThanOrEqual(128)
})
