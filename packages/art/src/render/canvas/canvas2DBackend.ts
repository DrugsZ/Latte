import {
  BlendMode,
  DEFAULT_RENDER_CAPABILITIES,
  LineCap,
  LineJoin,
  PaintStyle,
  PathCmd,
  RenderBackendType,
  RenderCommandType,
  ShaderType,
} from '../../contract/renderBackend'

import type {
  DrawEllipseCommand,
  DrawImageCommand,
  DrawPathCommand,
  DrawRectCommand,
  DrawTextCommand,
  GradientShader,
  ImageResourceManager,
  IRenderBackendDriver,
  Paint,
  PathHitTestBackend,
  PathResourceManager,
  RenderBackendOptions,
  RenderCapabilities,
  RenderCommandBuffer,
  RenderStats,
  RenderSurfaceManager,
  RenderSurface,
  RenderSurfaceSize,
  Shader,
  TextMeasureBackend,
} from '../../contract/renderBackend'

type Canvas2DSurface = HTMLCanvasElement | OffscreenCanvas

/**
 * Canvas2D implementation of the render backend
 */
export class Canvas2DRenderBackend
  implements
    IRenderBackendDriver,
    PathResourceManager,
    ImageResourceManager,
    RenderSurfaceManager,
    PathHitTestBackend,
    TextMeasureBackend
{
  public readonly type = RenderBackendType.Canvas2D
  public readonly capabilities: RenderCapabilities = {
    ...DEFAULT_RENDER_CAPABILITIES,
    conicGradient:
      typeof CanvasRenderingContext2D !== 'undefined' &&
      typeof CanvasRenderingContext2D.prototype.createConicGradient ===
        'function',
    softShadow: true,
    offscreenSurface: true,
    pathHitTest: true,
    clipPath: true,
    textBasic: true,
    textShaping: false,
    image: true,
    imageShader: true,
    runtimeEffect: false,
    blendModes: new Set([
      BlendMode.NORMAL,
      BlendMode.MULTIPLY,
      BlendMode.SCREEN,
      BlendMode.OVERLAY,
      BlendMode.DARKEN,
      BlendMode.LIGHTEN,
      BlendMode.COLOR_DODGE,
      BlendMode.COLOR_BURN,
      BlendMode.HARD_LIGHT,
      BlendMode.SOFT_LIGHT,
      BlendMode.DIFFERENCE,
      BlendMode.EXCLUSION,
      BlendMode.ADD,
      BlendMode.HUE,
      BlendMode.SATURATION,
      BlendMode.COLOR,
      BlendMode.LUMINOSITY,
    ]),
  }

  private _canvas: Canvas2DSurface | null = null
  private _ctx:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null = null
  private _dpr: number = 1

  // CPU state stack
  private _currentMatrix: Float32Array = new Float32Array([1, 0, 0, 1, 0, 0])
  private _clipStackDepth: number = 0
  // Resource management
  private _paths: Map<number, Path2D> = new Map()
  private _pathIdCounter: number = 1
  private _images: Map<
    string,
    HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas
  > = new Map()
  private _offscreenSurfaces: Map<number, Canvas2DSurface> = new Map()
  private _offscreenSurfaceIdCounter: number = 1
  private _currentSurface: number | null = null

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

  init(surface: RenderSurface, options: RenderBackendOptions = {}): void {
    if (surface.type === 'wasm-surface') {
      throw new Error('Canvas2D backend cannot initialize a WASM surface')
    }

    const canvas = surface.canvas
    const dpr = options.dpr ?? 1
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

  resize(size: RenderSurfaceSize): void {
    if (!this._canvas || !this._ctx) return

    const { width, height, dpr } = size
    this._dpr = dpr

    // Input size is CSS-space. Canvas2D owns backing-store scaling.
    this._canvas.width = width * dpr
    this._canvas.height = height * dpr

    // Reset transform and apply DPR scaling
    this._ctx.setTransform(1, 0, 0, 1, 0, 0)
    this._ctx.scale(dpr, dpr)
  }

  private _clearRect(
    x: number,
    y: number,
    w: number,
    h: number,
    color?: number
  ): void {
    if (!this._ctx) return
    if (color === undefined) {
      this._ctx.clearRect(x, y, w, h)
      return
    }

    const previousStyle = this._ctx.fillStyle
    this._ctx.fillStyle = this._colorToStyle(color)
    this._ctx.fillRect(x, y, w, h)
    this._ctx.fillStyle = previousStyle
  }

  private _getWidth(): number {
    return this._canvas ? this._canvas.width / this._dpr : 0
  }

  private _getHeight(): number {
    return this._canvas ? this._canvas.height / this._dpr : 0
  }

  getSize(): RenderSurfaceSize {
    return {
      width: this._getWidth(),
      height: this._getHeight(),
      dpr: this._dpr,
    }
  }

  dispose(): void {
    this._canvas = null
    this._ctx = null
  }

  // ==========================================
  // 2. Frame Control
  // ==========================================

  private _beginFrame(): void {
    if (!this._ctx || !this._canvas) return

    this._currentMatrix = new Float32Array([1, 0, 0, 1, 0, 0])
    this._clipStackDepth = 0
    this._ctx.setTransform(1, 0, 0, 1, 0, 0)
    this._ctx.scale(this._dpr, this._dpr)
    this._ctx.globalAlpha = 1
    this._ctx.globalCompositeOperation = 'source-over'
    this._ctx.shadowOffsetX = 0
    this._ctx.shadowOffsetY = 0
    this._ctx.shadowBlur = 0
    this._ctx.shadowColor = 'transparent'
    this._ctx.setLineDash([])
    this._ctx.lineDashOffset = 0
  }

  private _endFrame(): void {
    if (this._clipStackDepth > 0) {
      console.warn('Backend stack imbalance detected at endFrame')
    }
  }

  submit(commandBuffer: RenderCommandBuffer): void {
    if (!this._ctx) return

    this.resetStats()
    this._beginFrame()

    const clear = commandBuffer.pass.clear
    if (clear) {
      this._resetTransform()
      this._clearRect(clear.x, clear.y, clear.width, clear.height, clear.color)
    }

    const shaderCache = new Map<number, CanvasGradient | CanvasPattern>()
    for (const command of commandBuffer.commands) {
      switch (command.type) {
        case RenderCommandType.DrawRect:
          this._drawRectCommand(command, commandBuffer, shaderCache)
          break
        case RenderCommandType.DrawEllipse:
          this._drawEllipseCommand(command, commandBuffer, shaderCache)
          break
        case RenderCommandType.DrawPath:
          this._drawPathCommand(command, commandBuffer, shaderCache)
          break
        case RenderCommandType.DrawText:
          this._drawTextCommand(command, commandBuffer, shaderCache)
          break
        case RenderCommandType.DrawImage:
          this._drawImageCommand(command)
          break
        case RenderCommandType.PushClipRect:
          this._setTransform(command.transform)
          this._pushClip(command.x, command.y, command.width, command.height)
          break
        case RenderCommandType.PushClipPath:
          this._setTransform(command.transform)
          this._pushPathClip(command.pathId)
          break
        case RenderCommandType.PushLayer:
          this._pushLayer(command.alpha, command.blendMode)
          break
        case RenderCommandType.Pop:
          this._popState()
          break
      }
    }

    this._endFrame()
  }

  // ==========================================
  // 3. State Management
  // ==========================================

  private _setTransform(matrix: Float32Array): void {
    this._currentMatrix = new Float32Array(matrix)
    this._syncTransform()
  }

  private _resetTransform(): void {
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

  private _setGlobalAlpha(alpha: number): void {
    if (!this._ctx) return
    this._ctx.globalAlpha = alpha
  }

  private _pushClip(x: number, y: number, w: number, h: number): void {
    if (!this._ctx) return

    this._ctx.save()
    this._clipStackDepth++

    this._ctx.beginPath()
    this._ctx.rect(x, y, w, h)
    this._ctx.clip()
  }

  private _pushPathClip(pathId: number): void {
    if (!this._ctx) return
    const path = this._paths.get(pathId)
    if (!path) return

    this._ctx.save()
    this._clipStackDepth++
    this._ctx.clip(path)
  }

  private _pushLayer(alpha = 1, blendMode: BlendMode = BlendMode.NORMAL): void {
    if (!this._ctx) return

    this._ctx.save()
    this._clipStackDepth++
    this._ctx.globalAlpha *= alpha
    this._setBlendMode(blendMode)
  }

  private _popState(): void {
    if (!this._ctx || this._clipStackDepth === 0) return

    this._ctx.restore()
    this._clipStackDepth--

    this._syncTransform()
  }

  private _setBlendMode(mode: BlendMode): void {
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
      [BlendMode.SUBTRACT]: 'source-over',
      [BlendMode.HUE]: 'hue',
      [BlendMode.SATURATION]: 'saturation',
      [BlendMode.COLOR]: 'color',
      [BlendMode.LUMINOSITY]: 'luminosity',
    }

    this._ctx.globalCompositeOperation = blendModeMap[mode]
  }

  private _setShadow(
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

  private _clearShadow(): void {
    if (!this._ctx) return

    this._ctx.shadowOffsetX = 0
    this._ctx.shadowOffsetY = 0
    this._ctx.shadowBlur = 0
    this._ctx.shadowColor = 'transparent'
  }

  private _setLineStyle(
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

  private _setLineDash(segments: number[], offset: number = 0): void {
    if (!this._ctx) return

    this._ctx.setLineDash(segments)
    this._ctx.lineDashOffset = offset
  }

  private _clearLineDash(): void {
    if (!this._ctx) return

    this._ctx.setLineDash([])
    this._ctx.lineDashOffset = 0
  }

  // ==========================================
  // 4. Vector path resources
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
        case PathCmd.CONIC_TO:
          path.quadraticCurveTo(
            data[dataIndex],
            data[dataIndex + 1],
            data[dataIndex + 2],
            data[dataIndex + 3]
          )
          dataIndex += 5
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

  // ==========================================
  // 5. Text and image resources
  // ==========================================

  measureText(
    text: string,
    fontId: string,
    fontSize: number
  ): {
    width: number
    height: number
    actualBoundingBoxAscent?: number
    actualBoundingBoxDescent?: number
  } {
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

  private _drawImage(
    imageId: string,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    sx?: number,
    sy?: number,
    sw?: number,
    sh?: number,
    paint?: Paint
  ): void {
    if (!this._ctx) return

    const image = this._images.get(imageId)
    if (!image) {
      console.warn(`Image not found: ${imageId}`)
      return
    }

    this._ctx.save()
    if (paint) {
      this._applyPaintState(paint)
    }

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

    this._ctx.restore()
    this._syncTransform()

    this._stats.drawCalls++
    this._stats.textures++
  }

  private _drawRectCommand(
    command: DrawRectCommand,
    buffer: RenderCommandBuffer,
    shaderCache: Map<number, CanvasGradient | CanvasPattern>
  ) {
    if (!this._ctx) return
    this._setTransform(command.transform)
    this._applyPaintState(command.paint)

    this._ctx.beginPath()
    const { x, y, width, height, cornerRadius } = command
    if (typeof (this._ctx as any).roundRect === 'function') {
      if (typeof cornerRadius === 'number') {
        ;(this._ctx as any).roundRect(x, y, width, height, cornerRadius)
      } else {
        ;(this._ctx as any).roundRect(
          x,
          y,
          width,
          height,
          Array.from(cornerRadius)
        )
      }
    } else {
      this._buildRectPath(x, y, width, height, cornerRadius)
    }
    this._ctx.closePath()
    this._drawPathWithPaint(command.paint, buffer, shaderCache)
  }

  private _drawEllipseCommand(
    command: DrawEllipseCommand,
    buffer: RenderCommandBuffer,
    shaderCache: Map<number, CanvasGradient | CanvasPattern>
  ) {
    if (!this._ctx) return
    this._setTransform(command.transform)
    this._applyPaintState(command.paint)

    this._ctx.beginPath()
    this._ctx.ellipse(
      command.cx,
      command.cy,
      command.rx,
      command.ry,
      command.rotation,
      0,
      Math.PI * 2
    )
    this._ctx.closePath()
    this._drawPathWithPaint(command.paint, buffer, shaderCache)
  }

  private _drawPathCommand(
    command: DrawPathCommand,
    buffer: RenderCommandBuffer,
    shaderCache: Map<number, CanvasGradient | CanvasPattern>
  ) {
    if (!this._ctx) return
    const path = this._paths.get(command.pathId)
    if (!path) return

    this._setTransform(command.transform)
    this._applyPaintState(command.paint)
    this._drawPathWithPaint(command.paint, buffer, shaderCache, path)
  }

  private _drawTextCommand(
    command: DrawTextCommand,
    buffer: RenderCommandBuffer,
    shaderCache: Map<number, CanvasGradient | CanvasPattern>
  ) {
    if (!this._ctx) return
    this._setTransform(command.transform)
    this._applyPaintState(command.paint)

    this._ctx.font = `${command.fontSize}px ${command.fontId}`
    this._ctx.textAlign = command.align ?? 'left'
    this._ctx.textBaseline = command.baseline ?? 'alphabetic'

    const style = this._paintToStyle(command.paint, buffer, shaderCache)
    if (style && command.paint.style === PaintStyle.Fill) {
      this._ctx.fillStyle = style
      if (command.maxWidth !== undefined) {
        this._ctx.fillText(command.text, command.x, command.y, command.maxWidth)
      } else {
        this._ctx.fillText(command.text, command.x, command.y)
      }
    }

    if (
      style &&
      command.paint.style === PaintStyle.Stroke &&
      command.paint.stroke &&
      command.paint.stroke.width > 0
    ) {
      this._ctx.strokeStyle = style
      if (command.maxWidth !== undefined) {
        this._ctx.strokeText(
          command.text,
          command.x,
          command.y,
          command.maxWidth
        )
      } else {
        this._ctx.strokeText(command.text, command.x, command.y)
      }
    }

    this._stats.drawCalls++
  }

  private _drawImageCommand(command: DrawImageCommand) {
    this._setTransform(command.transform)
    this._drawImage(
      command.imageId,
      command.dx,
      command.dy,
      command.dw,
      command.dh,
      command.sx,
      command.sy,
      command.sw,
      command.sh,
      command.paint
    )
  }

  private _drawPathWithPaint(
    paint: Paint,
    buffer: RenderCommandBuffer,
    shaderCache: Map<number, CanvasGradient | CanvasPattern>,
    path?: Path2D
  ) {
    if (!this._ctx) return

    const style = this._paintToStyle(paint, buffer, shaderCache)
    if (!style) {
      return
    }

    if (paint.style === PaintStyle.Fill) {
      this._ctx.fillStyle = style
      if (path) {
        this._ctx.fill(path)
      } else {
        this._ctx.fill()
      }
    } else if (paint.stroke && paint.stroke.width > 0) {
      this._ctx.strokeStyle = style
      if (path) {
        this._ctx.stroke(path)
      } else {
        this._ctx.stroke()
      }
    }

    this._stats.drawCalls++
  }

  private _applyPaintState(paint: Paint) {
    if (!this._ctx) return

    this._setGlobalAlpha(paint.alpha ?? 1)
    this._setBlendMode(paint.blendMode ?? BlendMode.NORMAL)
    if (paint.stroke) {
      this._setLineStyle(
        paint.stroke.width,
        paint.stroke.cap ?? LineCap.BUTT,
        paint.stroke.join ?? LineJoin.MITER,
        paint.stroke.miterLimit
      )
      if (paint.stroke.dash && paint.stroke.dash.length > 0) {
        this._setLineDash([...paint.stroke.dash], paint.stroke.dashOffset ?? 0)
      } else {
        this._clearLineDash()
      }
    } else {
      this._clearLineDash()
    }

    const shadow = paint.effects?.find(effect => effect.type === 'drop-shadow')
    if (shadow) {
      this._setShadow(
        shadow.offsetX ?? 0,
        shadow.offsetY ?? 0,
        shadow.blur ?? 0,
        shadow.color ?? 0
      )
    } else {
      this._clearShadow()
    }
  }

  private _buildRectPath(
    x: number,
    y: number,
    width: number,
    height: number,
    cornerRadius: number | Float32Array
  ) {
    if (!this._ctx) return

    if (typeof cornerRadius === 'number' && cornerRadius > 0) {
      const r = Math.min(cornerRadius, width / 2, height / 2)
      this._ctx.moveTo(x + r, y)
      this._ctx.lineTo(x + width - r, y)
      this._ctx.arcTo(x + width, y, x + width, y + r, r)
      this._ctx.lineTo(x + width, y + height - r)
      this._ctx.arcTo(x + width, y + height, x + width - r, y + height, r)
      this._ctx.lineTo(x + r, y + height)
      this._ctx.arcTo(x, y + height, x, y + height - r, r)
      this._ctx.lineTo(x, y + r)
      this._ctx.arcTo(x, y, x + r, y, r)
      return
    }

    if (cornerRadius instanceof Float32Array) {
      const [tl, tr, br, bl] = Array.from(cornerRadius)
      this._ctx.moveTo(x + tl, y)
      this._ctx.lineTo(x + width - tr, y)
      if (tr > 0) this._ctx.arcTo(x + width, y, x + width, y + tr, tr)
      this._ctx.lineTo(x + width, y + height - br)
      if (br > 0) {
        this._ctx.arcTo(x + width, y + height, x + width - br, y + height, br)
      }
      this._ctx.lineTo(x + bl, y + height)
      if (bl > 0) this._ctx.arcTo(x, y + height, x, y + height - bl, bl)
      this._ctx.lineTo(x, y + tl)
      if (tl > 0) this._ctx.arcTo(x, y, x + tl, y, tl)
      return
    }

    this._ctx.rect(x, y, width, height)
  }

  // ==========================================
  // 6. Image resources
  // ==========================================

  async uploadImage(imageId: string, source: TexImageSource): Promise<void> {
    if (
      (typeof HTMLImageElement !== 'undefined' &&
        source instanceof HTMLImageElement) ||
      (typeof HTMLCanvasElement !== 'undefined' &&
        source instanceof HTMLCanvasElement) ||
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

  createOffscreenSurface(
    width: number,
    height: number,
    _samples?: number
  ): number {
    let offscreenCanvas: HTMLCanvasElement | OffscreenCanvas

    if (
      typeof OffscreenCanvas !== 'undefined' &&
      this._canvas instanceof OffscreenCanvas
    ) {
      offscreenCanvas = new OffscreenCanvas(
        width * this._dpr,
        height * this._dpr
      )
    } else if (typeof document !== 'undefined') {
      offscreenCanvas = document.createElement('canvas')
      offscreenCanvas.width = width * this._dpr
      offscreenCanvas.height = height * this._dpr
    } else {
      throw new Error(
        'Environment does not support creating new canvas instances'
      )
    }

    const ctx = offscreenCanvas.getContext('2d')
    if (ctx) {
      ctx.scale(this._dpr, this._dpr)
    }

    const id = this._offscreenSurfaceIdCounter++
    this._offscreenSurfaces.set(id, offscreenCanvas)
    return id
  }

  deleteOffscreenSurface(surfaceId: number): void {
    this._offscreenSurfaces.delete(surfaceId)
  }

  setSurface(surfaceId: number | null): void {
    if (this._currentSurface === surfaceId) {
      return
    }
    if (surfaceId === null) {
      this._currentSurface = null
      if (this._canvas) {
        this._ctx = this._canvas.getContext('2d')
      }
    } else {
      const target = this._offscreenSurfaces.get(surfaceId)
      if (target) {
        this._currentSurface = surfaceId
        this._ctx = target.getContext('2d')
      }
    }
  }

  blitSurface(
    surfaceId: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void {
    if (!this._ctx) return

    const target = this._offscreenSurfaces.get(surfaceId)
    if (!target) {
      console.warn(`Offscreen surface not found: ${surfaceId}`)
      return
    }

    this._ctx.drawImage(target, dx, dy, dw, dh)
    this._stats.drawCalls++
  }

  getStats(): RenderStats {
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

  isPointInPath(
    pathId: number,
    x: number,
    y: number,
    transform?: Float32Array,
    fillRule: 'nonzero' | 'evenodd' = 'nonzero'
  ): boolean {
    if (!this._ctx) return false
    const path = this._paths.get(pathId)
    if (!path) return false

    if (transform) {
      const local = this._toLocalPoint(transform, x, y)
      if (!local) {
        return false
      }
      return this._ctx.isPointInPath(path, local.x, local.y, fillRule)
    }

    return this._ctx.isPointInPath(path, x, y, fillRule)
  }

  isPointInStroke(
    pathId: number,
    x: number,
    y: number,
    transform?: Float32Array,
    strokeWidth?: number
  ): boolean {
    if (!this._ctx) return false
    const path = this._paths.get(pathId)
    if (!path) return false

    let hitX = x
    let hitY = y
    if (transform) {
      const local = this._toLocalPoint(transform, x, y)
      if (!local) {
        return false
      }
      hitX = local.x
      hitY = local.y
    }

    const prevLineWidth = this._ctx.lineWidth
    if (strokeWidth !== undefined) {
      this._ctx.lineWidth = strokeWidth
    }

    const result = this._ctx.isPointInStroke(path, hitX, hitY)
    this._ctx.lineWidth = prevLineWidth
    return result
  }

  private _colorToStyle(color: number): string {
    if (color === 0) return 'transparent'

    const r = (color >> 24) & 0xff
    const g = (color >> 16) & 0xff
    const b = (color >> 8) & 0xff
    const a = (color & 0xff) / 255

    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  private _paintToStyle(
    paint: Paint,
    buffer: RenderCommandBuffer,
    shaderCache: Map<number, CanvasGradient | CanvasPattern>
  ): string | CanvasGradient | CanvasPattern | null {
    if (paint.color !== undefined) {
      return this._colorToStyle(paint.color)
    }
    if (!paint.shader) {
      return null
    }

    const cached = shaderCache.get(paint.shader.id)
    if (cached) {
      return cached
    }

    const shader = buffer.getShader(paint.shader.id)
    if (!shader) {
      return null
    }

    const canvasShader = this._createCanvasShader(shader)
    if (!canvasShader) {
      return null
    }

    shaderCache.set(paint.shader.id, canvasShader)
    return canvasShader
  }

  private _createCanvasShader(
    shader: Shader
  ): CanvasGradient | CanvasPattern | null {
    if (!this._ctx) {
      return null
    }

    if (shader.type === ShaderType.IMAGE) {
      const image = this._images.get(shader.imageId)
      if (!image) {
        return null
      }
      const pattern = this._ctx.createPattern(
        image,
        shader.repetition ?? 'repeat'
      )
      if (!pattern) {
        return null
      }
      if (shader.transform) {
        pattern.setTransform({
          a: shader.transform[0],
          b: shader.transform[1],
          c: shader.transform[2],
          d: shader.transform[3],
          e: shader.transform[4],
          f: shader.transform[5],
        })
      }
      return pattern
    }

    if (shader.type === ShaderType.RUNTIME_EFFECT) {
      return null
    }

    const gradient = shader as GradientShader
    const coords = gradient.coords
    let canvasGradient: CanvasGradient
    switch (gradient.type) {
      case ShaderType.LINEAR_GRADIENT:
        canvasGradient = this._ctx.createLinearGradient(
          coords[0],
          coords[1],
          coords[2],
          coords[3]
        )
        break
      case ShaderType.RADIAL_GRADIENT:
        canvasGradient = this._ctx.createRadialGradient(
          coords[0],
          coords[1],
          coords[2],
          coords[3],
          coords[4],
          coords[5]
        )
        break
      case ShaderType.CONIC_GRADIENT:
        if (typeof this._ctx.createConicGradient !== 'function') {
          return null
        }
        canvasGradient = this._ctx.createConicGradient(
          coords[2],
          coords[0],
          coords[1]
        )
        break
      default:
        return null
    }

    for (const stop of gradient.stops) {
      canvasGradient.addColorStop(stop.offset, this._colorToStyle(stop.color))
    }
    return canvasGradient
  }

  private _toLocalPoint(transform: Float32Array, x: number, y: number) {
    const a = transform[0]
    const b = transform[1]
    const c = transform[2]
    const d = transform[3]
    const e = transform[4]
    const f = transform[5]
    const det = a * d - b * c
    if (Math.abs(det) < 1e-12) {
      return null
    }

    const dx = x - e
    const dy = y - f
    return {
      x: (d * dx - c * dy) / det,
      y: (-b * dx + a * dy) / det,
    }
  }
}
