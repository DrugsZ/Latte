import { afterEach, describe, expect, it, vi } from 'vitest'

import { Canvas2DRenderBackend } from '../canvas2DBackend'
import {
  PaintStyle,
  RenderCommandBuffer,
  RenderCommandType,
} from '../../../contract/renderBackend'

// A one-pixel source-over raster model catches group-vs-per-paint alpha errors
// without relying on a native Canvas implementation in the unit test runtime.
class PixelContext {
  public alpha = 0
  public globalAlpha = 1
  public globalCompositeOperation = 'source-over'
  public fillStyle = ''
  public shadowOffsetX = 0
  public shadowOffsetY = 0
  public shadowBlur = 0
  public shadowColor = 'transparent'
  public lineDashOffset = 0
  private _stack: { globalAlpha: number; globalCompositeOperation: string }[] =
    []
  constructor(public readonly canvas: PixelCanvas) {}
  public setTransform() {}
  public scale() {}
  public setLineDash() {}
  public beginPath() {}
  public closePath() {}
  public rect() {}
  public ellipse() {}
  public save() {
    this._stack.push({
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
    })
  }
  public restore() {
    Object.assign(this, this._stack.pop())
  }
  public clearRect() {
    this.alpha = 0
  }
  public fill() {
    const paintAlpha = Number(this.fillStyle.match(/, ([\d.]+)\)$/)?.[1] ?? 1)
    this._composite(paintAlpha * this.globalAlpha)
  }
  public drawImage(source: PixelCanvas) {
    this._composite(source.context.alpha * this.globalAlpha)
  }
  public reset() {
    this.alpha = 0
    this.globalAlpha = 1
    this.globalCompositeOperation = 'source-over'
    this._stack = []
  }
  private _composite(alpha: number) {
    this.alpha = alpha + this.alpha * (1 - alpha)
  }
}

class PixelCanvas {
  public readonly context = new PixelContext(this)
  private _width = 0
  private _height = 0
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  get width() {
    return this._width
  }
  set width(value: number) {
    this._width = value
    this.context.reset()
  }
  get height() {
    return this._height
  }
  set height(value: number) {
    this._height = value
    this.context.reset()
  }
  public getContext() {
    return this.context
  }
}

const drawRect = (buffer: RenderCommandBuffer, alpha = 1) =>
  buffer.push({
    type: RenderCommandType.DrawRect,
    transform: new Float32Array([1, 0, 0, 1, 0, 0]),
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    cornerRadius: 0,
    paint: { style: PaintStyle.Fill, color: 0xff0000ff, alpha },
  })

const render = (buffer: RenderCommandBuffer) => {
  vi.stubGlobal('OffscreenCanvas', PixelCanvas)
  const canvas = new PixelCanvas(1, 1)
  const backend = new Canvas2DRenderBackend()
  backend.init({
    type: 'offscreen-canvas',
    canvas: canvas as unknown as OffscreenCanvas,
  })
  backend.submit(buffer)
  return canvas.context.alpha
}

afterEach(() => vi.unstubAllGlobals())

describe('Canvas2D opacity compositing', () => {
  it('composites overlapping opaque children once at the group opacity', () => {
    const buffer = new RenderCommandBuffer()
    buffer.push({ type: RenderCommandType.PushLayer, alpha: 0.5 })
    drawRect(buffer)
    drawRect(buffer)
    buffer.push({ type: RenderCommandType.Pop })
    expect(render(buffer)).toBe(0.5)
  })

  it('combines nested layer opacity and paint alpha without overwriting either', () => {
    const buffer = new RenderCommandBuffer()
    buffer.push({ type: RenderCommandType.PushLayer, alpha: 0.5 })
    buffer.push({ type: RenderCommandType.PushLayer, alpha: 0.5 })
    drawRect(buffer, 0.5)
    buffer.push({ type: RenderCommandType.Pop })
    buffer.push({ type: RenderCommandType.Pop })
    expect(render(buffer)).toBe(0.125)
  })

  it('restores the destination context for subsequent siblings', () => {
    const buffer = new RenderCommandBuffer()
    buffer.push({ type: RenderCommandType.PushLayer, alpha: 0 })
    drawRect(buffer)
    buffer.push({ type: RenderCommandType.Pop })
    drawRect(buffer)
    expect(render(buffer)).toBe(1)
  })
})
