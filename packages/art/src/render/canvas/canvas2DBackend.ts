import {
  BlendMode,
  GradientType,
  LineCap,
  LineJoin,
  PathCmd,
} from '../../contract/renderBackend'

import type {
  CanvasLike,
  Gradient,
  IRenderBackend,
  TextMetrics,
} from '../../contract/renderBackend'

/**
 * Canvas2D implementation of the render backend
 */
export class Canvas2DRenderBackend implements IRenderBackend {
  private _canvas: CanvasLike | null = null
  private _ctx:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null = null
  private _dpr: number = 1

  // CPU state stack
  private _currentMatrix: Float32Array = new Float32Array([1, 0, 0, 1, 0, 0])
  private _clipStackDepth: number = 0
  private _globalAlpha: number = 1

  // Resource management
  private _gradients: Map<number, CanvasGradient> = new Map()
  private _gradientIdCounter: number = 1
  private _paths: Map<number, Path2D> = new Map()
  private _pathIdCounter: number = 1
  private _images: Map<
    string,
    HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas
  > = new Map()
  private _renderTargets: Map<number, HTMLCanvasElement> = new Map()
  private _renderTargetIdCounter: number = 1
  private _currentRenderTarget: number | null = null

  // Performance statistics
  private _stats = {
    drawCalls: 0,
    triangles: 0,
    vertices: 0,
    textures: 0,
  }

  // ==========================================
  // 1. Lifecycle
  // ==========================================

  init(canvas: CanvasLike, dpr: number = 1): void {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new Error('Invalid canvas instance')
    }

    this._canvas = canvas
    this._dpr = dpr

    this._ctx = this._canvas!.getContext('2d', {
      alpha: true,
      desynchronized: true,
    }) as any

    if (!this._ctx) {
      throw new Error('Could not get 2D rendering context')
    }

    // Apply initial scaling
    this._ctx.setTransform(1, 0, 0, 1, 0, 0)
    this._ctx.scale(this._dpr, this._dpr)
  }

  resize(width: number, height: number, dpr: number): void {
    if (!this._canvas || !this._ctx) return

    this._dpr = dpr

    // Set physical pixel size
    this._canvas.width = width * dpr
    this._canvas.height = height * dpr

    // Reset transform and apply DPR scaling
    this._ctx.setTransform(1, 0, 0, 1, 0, 0)
    this._ctx.scale(dpr, dpr)
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    if (!this._ctx) return
    this._ctx.clearRect(x, y, w, h)
  }

  getWidth(): number {
    return this._canvas ? this._canvas.width / this._dpr : 0
  }

  getHeight(): number {
    return this._canvas ? this._canvas.height / this._dpr : 0
  }

  dispose(): void {
    this._canvas = null
    this._ctx = null
  }

  // ==========================================
  // 2. Frame Control
  // ==========================================

  beginFrame(): void {
    if (!this._ctx || !this._canvas) return

    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)

    this._currentMatrix = new Float32Array([1, 0, 0, 1, 0, 0])
    this._clipStackDepth = 0
    this._globalAlpha = 1

    this._ctx.setTransform(1, 0, 0, 1, 0, 0)
    this._ctx.scale(this._dpr, this._dpr)
  }

  endFrame(): void {
    if (this._clipStackDepth > 0) {
      console.warn('Backend stack imbalance detected at endFrame')
    }
  }

  // ==========================================
  // 3. State Management
  // ==========================================

  setTransform(matrix: Float32Array): void {
    this._currentMatrix = new Float32Array(matrix)
    this._syncTransform()
  }

  resetTransform(): void {
    this._currentMatrix = new Float32Array([1, 0, 0, 1, 0, 0])
    this._syncTransform()
  }

  private _syncTransform(): void {
    if (!this._ctx) return
    this._ctx.setTransform(
      this._currentMatrix[0] * this._dpr,
      this._currentMatrix[1] * this._dpr,
      this._currentMatrix[2] * this._dpr,
      this._currentMatrix[3] * this._dpr,
      this._currentMatrix[4] * this._dpr,
      this._currentMatrix[5] * this._dpr
    )
  }

  setGlobalAlpha(alpha: number): void {
    if (!this._ctx) return
    this._globalAlpha = alpha
    this._ctx.globalAlpha = alpha
  }

  pushClip(x: number, y: number, w: number, h: number): void {
    if (!this._ctx) return

    this._ctx.save()
    this._clipStackDepth++

    this._ctx.beginPath()
    this._ctx.rect(x, y, w, h)
    this._ctx.clip()
  }

  popClip(): void {
    if (!this._ctx || this._clipStackDepth === 0) return

    this._ctx.restore()
    this._clipStackDepth--

    this._syncTransform()
    this._ctx.globalAlpha = this._globalAlpha
  }

  setBlendMode(mode: BlendMode): void {
    if (!this._ctx) return

    const blendModeMap: Record<BlendMode, GlobalCompositeOperation> = {
      [BlendMode.NORMAL]: 'source-over',
      [BlendMode.MULTIPLY]: 'multiply',
      [BlendMode.SCREEN]: 'screen',
      [BlendMode.OVERLAY]: 'overlay',
      [BlendMode.DARKEN]: 'darken',
      [BlendMode.LIGHTEN]: 'lighten',
      [BlendMode.COLOR_DODGE]: 'color-dodge',
      [BlendMode.COLOR_BURN]: 'color-burn',
      [BlendMode.HARD_LIGHT]: 'hard-light',
      [BlendMode.SOFT_LIGHT]: 'soft-light',
      [BlendMode.DIFFERENCE]: 'difference',
      [BlendMode.EXCLUSION]: 'exclusion',
      [BlendMode.ADD]: 'lighter',
      [BlendMode.SUBTRACT]: 'difference',
    }

    this._ctx.globalCompositeOperation = blendModeMap[mode]
  }

  setShadow(
    offsetX: number,
    offsetY: number,
    blur: number,
    color: number
  ): boolean {
    if (!this._ctx) return false

    this._ctx.shadowOffsetX = offsetX
    this._ctx.shadowOffsetY = offsetY
    this._ctx.shadowBlur = blur
    this._ctx.shadowColor = this._colorToStyle(color)

    return true
  }

  clearShadow(): void {
    if (!this._ctx) return

    this._ctx.shadowOffsetX = 0
    this._ctx.shadowOffsetY = 0
    this._ctx.shadowBlur = 0
    this._ctx.shadowColor = 'transparent'
  }

  setLineStyle(
    width: number,
    cap: LineCap,
    join: LineJoin,
    miterLimit?: number
  ): void {
    if (!this._ctx) return

    const capMap: Record<LineCap, CanvasLineCap> = {
      [LineCap.BUTT]: 'butt',
      [LineCap.ROUND]: 'round',
      [LineCap.SQUARE]: 'square',
    }

    const joinMap: Record<LineJoin, CanvasLineJoin> = {
      [LineJoin.MITER]: 'miter',
      [LineJoin.ROUND]: 'round',
      [LineJoin.BEVEL]: 'bevel',
    }

    this._ctx.lineWidth = width
    this._ctx.lineCap = capMap[cap]
    this._ctx.lineJoin = joinMap[join]

    if (miterLimit !== undefined) {
      this._ctx.miterLimit = miterLimit
    }
  }

  setLineDash(segments: number[], offset: number = 0): void {
    if (!this._ctx) return

    this._ctx.setLineDash(segments)
    this._ctx.lineDashOffset = offset
  }

  clearLineDash(): void {
    if (!this._ctx) return

    this._ctx.setLineDash([])
    this._ctx.lineDashOffset = 0
  }

  // ==========================================
  // 4. Basic Shapes
  // ==========================================

  drawRect(
    x: number,
    y: number,
    w: number,
    h: number,
    cornerRadius: number | Float32Array,
    fill?: number,
    stroke?: number,
    strokeWidth?: number
  ): void {
    if (!this._ctx) return

    this._ctx.beginPath()
    if (typeof (this._ctx as any).roundRect === 'function') {
      if (typeof cornerRadius === 'number') {
        ;(this._ctx as any).roundRect(x, y, w, h, cornerRadius)
      } else if (cornerRadius instanceof Float32Array) {
        ;(this._ctx as any).roundRect(x, y, w, h, Array.from(cornerRadius))
      } else {
        this._ctx.rect(x, y, w, h)
      }
    } else {
      if (typeof cornerRadius === 'number' && cornerRadius > 0) {
        const r = Math.min(cornerRadius, w / 2, h / 2)
        this._ctx.moveTo(x + r, y)
        this._ctx.lineTo(x + w - r, y)
        this._ctx.arcTo(x + w, y, x + w, y + r, r)
        this._ctx.lineTo(x + w, y + h - r)
        this._ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
        this._ctx.lineTo(x + r, y + h)
        this._ctx.arcTo(x, y + h, x, y + h - r, r)
        this._ctx.lineTo(x, y + r)
        this._ctx.arcTo(x, y, x + r, y, r)
      } else if (cornerRadius instanceof Float32Array) {
        const [tl, tr, br, bl] = Array.from(cornerRadius)
        this._ctx.moveTo(x + tl, y)
        this._ctx.lineTo(x + w - tr, y)
        if (tr > 0) this._ctx.arcTo(x + w, y, x + w, y + tr, tr)
        this._ctx.lineTo(x + w, y + h - br)
        if (br > 0) this._ctx.arcTo(x + w, y + h, x + w - br, y + h, br)
        this._ctx.lineTo(x + bl, y + h)
        if (bl > 0) this._ctx.arcTo(x, y + h, x, y + h - bl, bl)
        this._ctx.lineTo(x, y + tl)
        if (tl > 0) this._ctx.arcTo(x, y, x + tl, y, tl)
      } else {
        this._ctx.rect(x, y, w, h)
      }
    }

    this._ctx.closePath()

    if (fill !== undefined) {
      this._ctx.fillStyle = this._paintIdToStyle(fill)
      this._ctx.fill()
    }

    if (stroke !== undefined && strokeWidth && strokeWidth > 0) {
      this._ctx.strokeStyle = this._paintIdToStyle(stroke)
      this._ctx.lineWidth = strokeWidth
      this._ctx.stroke()
    }

    this._stats.drawCalls++
  }

  drawEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rotation: number,
    fill?: number,
    stroke?: number,
    strokeWidth?: number
  ): void {
    if (!this._ctx) return

    this._ctx.beginPath()
    this._ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2)
    this._ctx.closePath()

    if (fill !== undefined) {
      this._ctx.fillStyle = this._paintIdToStyle(fill)
      this._ctx.fill()
    }

    if (stroke !== undefined && strokeWidth && strokeWidth > 0) {
      this._ctx.strokeStyle = this._paintIdToStyle(stroke)
      this._ctx.lineWidth = strokeWidth
      this._ctx.stroke()
    }

    this._stats.drawCalls++
  }

  // ==========================================
  // 5. Vector Paths
  // ==========================================

  createPath(commands: Uint8Array, data: Float32Array): number {
    const path = new Path2D()
    let dataIndex = 0

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i]
      switch (cmd) {
        case PathCmd.MOVE_TO:
          path.moveTo(data[dataIndex], data[dataIndex + 1])
          dataIndex += 2
          break
        case PathCmd.LINE_TO:
          path.lineTo(data[dataIndex], data[dataIndex + 1])
          dataIndex += 2
          break
        case PathCmd.QUAD_TO:
          path.quadraticCurveTo(
            data[dataIndex],
            data[dataIndex + 1],
            data[dataIndex + 2],
            data[dataIndex + 3]
          )
          dataIndex += 4
          break
        case PathCmd.CUBIC_TO:
          path.bezierCurveTo(
            data[dataIndex],
            data[dataIndex + 1],
            data[dataIndex + 2],
            data[dataIndex + 3],
            data[dataIndex + 4],
            data[dataIndex + 5]
          )
          dataIndex += 6
          break
        case PathCmd.ARC:
          path.arc(
            data[dataIndex],
            data[dataIndex + 1],
            data[dataIndex + 2],
            data[dataIndex + 3],
            data[dataIndex + 4],
            data[dataIndex + 5] === 1
          )
          dataIndex += 6
          break
        case PathCmd.CLOSE:
          path.closePath()
          break
      }
    }

    const id = this._pathIdCounter++
    this._paths.set(id, path)
    return id
  }

  deletePath(pathId: number): void {
    this._paths.delete(pathId)
  }

  drawPath(
    pathId: number,
    fill?: number,
    stroke?: number,
    strokeWidth?: number
  ): void {
    if (!this._ctx) return
    const path = this._paths.get(pathId)
    if (!path) return

    if (fill !== undefined) {
      this._ctx.fillStyle = this._paintIdToStyle(fill)
      this._ctx.fill(path)
    }

    if (stroke !== undefined && strokeWidth && strokeWidth > 0) {
      this._ctx.strokeStyle = this._paintIdToStyle(stroke)
      this._ctx.lineWidth = strokeWidth
      this._ctx.stroke(path)
    }

    this._stats.drawCalls++
  }

  // ==========================================
  // 6. High-level Objects
  // ==========================================

  drawText(
    text: string,
    x: number,
    y: number,
    fontId: string,
    fontSize: number,
    fill?: number,
    stroke?: number,
    strokeWidth?: number,
    align: 'left' | 'center' | 'right' = 'left',
    baseline: 'top' | 'middle' | 'bottom' | 'alphabetic' = 'alphabetic',
    maxWidth?: number
  ): void {
    if (!this._ctx) return

    this._ctx.font = `${fontSize}px ${fontId}`
    this._ctx.textAlign = align
    this._ctx.textBaseline = baseline

    if (fill !== undefined) {
      this._ctx.fillStyle = this._paintIdToStyle(fill)
      if (maxWidth !== undefined) {
        this._ctx.fillText(text, x, y, maxWidth)
      } else {
        this._ctx.fillText(text, x, y)
      }
    }

    if (stroke !== undefined && strokeWidth && strokeWidth > 0) {
      this._ctx.strokeStyle = this._paintIdToStyle(stroke)
      this._ctx.lineWidth = strokeWidth
      if (maxWidth !== undefined) {
        this._ctx.strokeText(text, x, y, maxWidth)
      } else {
        this._ctx.strokeText(text, x, y)
      }
    }

    this._stats.drawCalls++
  }

  measureText(text: string, fontId: string, fontSize: number): TextMetrics {
    if (!this._ctx) {
      return { width: 0, height: 0 }
    }

    this._ctx.font = `${fontSize}px ${fontId}`
    const metrics = this._ctx.measureText(text)

    return {
      width: metrics.width,
      height:
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent ||
        fontSize,
      actualBoundingBoxAscent: metrics.actualBoundingBoxAscent,
      actualBoundingBoxDescent: metrics.actualBoundingBoxDescent,
    }
  }

  drawImage(
    imageId: string,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    sx?: number,
    sy?: number,
    sw?: number,
    sh?: number,
    opacity: number = 1
  ): void {
    if (!this._ctx) return

    const image = this._images.get(imageId)
    if (!image) {
      console.warn(`Image not found: ${imageId}`)
      return
    }

    const prevAlpha = this._ctx.globalAlpha
    this._ctx.globalAlpha = opacity

    if (
      sx !== undefined &&
      sy !== undefined &&
      sw !== undefined &&
      sh !== undefined
    ) {
      this._ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
    } else {
      this._ctx.drawImage(image, dx, dy, dw, dh)
    }

    this._ctx.globalAlpha = prevAlpha

    this._stats.drawCalls++
    this._stats.textures++
  }

  drawPattern(
    x: number,
    y: number,
    w: number,
    h: number,
    imageId: string,
    repetition: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat'
  ): void {
    if (!this._ctx) return

    const image = this._images.get(imageId)
    if (!image) {
      console.warn(`Image not found for pattern: ${imageId}`)
      return
    }

    const pattern = this._ctx.createPattern(image, repetition)
    if (!pattern) return

    this._ctx.fillStyle = pattern
    this._ctx.fillRect(x, y, w, h)

    this._stats.drawCalls++
  }

  // ==========================================
  // 7. Textures and Resources
  // ==========================================

  createGradient(gradient: Gradient): number {
    if (!this._ctx) return 0

    let canvasGradient: CanvasGradient

    const coords = gradient.coords

    switch (gradient.type) {
      case GradientType.LINEAR:
        canvasGradient = this._ctx.createLinearGradient(
          coords[0],
          coords[1],
          coords[2],
          coords[3]
        )
        break

      case GradientType.RADIAL:
        canvasGradient = this._ctx.createRadialGradient(
          coords[0],
          coords[1],
          coords[2],
          coords[3],
          coords[4],
          coords[5]
        )
        break

      case GradientType.CONIC:
        canvasGradient = this._ctx.createConicGradient(
          coords[2],
          coords[0],
          coords[1]
        )
        break

      default:
        console.warn('Unsupported gradient type')
        return 0
    }

    for (const stop of gradient.stops) {
      canvasGradient.addColorStop(stop.offset, this._colorToStyle(stop.color))
    }

    const id = this._gradientIdCounter++
    this._gradients.set(id, canvasGradient)
    return id
  }

  deleteGradient(gradientId: number): void {
    this._gradients.delete(gradientId)
  }

  async uploadImage(imageId: string, source: TexImageSource): Promise<void> {
    if (
      source instanceof HTMLImageElement ||
      source instanceof HTMLCanvasElement ||
      (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) ||
      (typeof OffscreenCanvas !== 'undefined' &&
        source instanceof OffscreenCanvas)
    ) {
      this._images.set(imageId, source as any)
    } else {
      console.warn('Unsupported image source type')
    }
  }

  deleteImage(imageId: string): void {
    this._images.delete(imageId)
  }

  createRenderTarget(width: number, height: number, _samples?: number): number {
    // Attempt to create a new canvas of the same type as the main canvas
    let offscreenCanvas: any

    if (this._canvas && (this._canvas as any).constructor) {
      // For OffscreenCanvas or Node-Canvas instances
      const CanvasClass = (this._canvas as any).constructor
      offscreenCanvas = new CanvasClass()
    } else if (typeof document !== 'undefined') {
      offscreenCanvas = document.createElement('canvas')
    } else {
      throw new Error(
        'Environment does not support creating new canvas instances'
      )
    }

    offscreenCanvas.width = width * this._dpr
    offscreenCanvas.height = height * this._dpr

    const ctx = offscreenCanvas.getContext('2d')
    if (ctx) {
      ctx.scale(this._dpr, this._dpr)
    }

    const id = this._renderTargetIdCounter++
    this._renderTargets.set(id, offscreenCanvas)
    return id
  }

  deleteRenderTarget(targetId: number): void {
    this._renderTargets.delete(targetId)
  }

  setRenderTarget(targetId: number | null): void {
    if (this._currentRenderTarget === targetId) {
      return
    }
    if (targetId === null) {
      this._currentRenderTarget = null
      if (this._canvas) {
        this._ctx = this._canvas.getContext('2d')
      }
    } else {
      const target = this._renderTargets.get(targetId)
      if (target) {
        this._currentRenderTarget = targetId
        this._ctx = target.getContext('2d')
      }
    }
  }

  blitRenderTarget(
    targetId: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void {
    if (!this._ctx) return

    const target = this._renderTargets.get(targetId)
    if (!target) {
      console.warn(`Render target not found: ${targetId}`)
      return
    }

    this._ctx.drawImage(target, dx, dy, dw, dh)
    this._stats.drawCalls++
  }

  getStats(): {
    drawCalls: number
    triangles: number
    vertices: number
    textures: number
  } {
    return { ...this._stats }
  }

  resetStats(): void {
    this._stats = {
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      textures: 0,
    }
  }

  drawDebugRect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: number
  ): void {
    if (!this._ctx) return

    this._ctx.strokeStyle = this._colorToStyle(color)
    this._ctx.lineWidth = 1
    this._ctx.strokeRect(x, y, w, h)
  }

  isPointInPath(
    pathId: number,
    x: number,
    y: number,
    _transform?: Float32Array,
    fillRule: 'nonzero' | 'evenodd' = 'nonzero'
  ): boolean {
    if (!this._ctx) return false
    const path = this._paths.get(pathId)
    if (!path) return false

    if (_transform) {
      return this._ctx.isPointInPath(path, x, y, fillRule)
    }

    return this._ctx.isPointInPath(path, x, y, fillRule)
  }

  isPointInStroke(
    pathId: number,
    x: number,
    y: number,
    _transform?: Float32Array,
    strokeWidth?: number
  ): boolean {
    if (!this._ctx) return false
    const path = this._paths.get(pathId)
    if (!path) return false

    const prevLineWidth = this._ctx.lineWidth
    if (strokeWidth !== undefined) {
      this._ctx.lineWidth = strokeWidth
    }

    const result = this._ctx.isPointInStroke(path, x, y)
    this._ctx.lineWidth = prevLineWidth
    return result
  }

  getBackendType(): string {
    return 'canvas2d'
  }

  private _colorToStyle(color: number): string {
    if (color === 0) return 'transparent'

    const r = (color >> 24) & 0xff
    const g = (color >> 16) & 0xff
    const b = (color >> 8) & 0xff
    const a = (color & 0xff) / 255

    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  private _paintIdToStyle(paintId: number): string | CanvasGradient {
    const gradient = this._gradients.get(paintId)
    if (gradient) {
      return gradient
    }
    return this._colorToStyle(paintId)
  }
}
