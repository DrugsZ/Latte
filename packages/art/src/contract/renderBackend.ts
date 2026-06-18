/**
 * Backend-neutral path command stream.
 *
 * This mirrors the shape of SkPath closely enough for CanvasKit/Skia and can
 * still be consumed by Canvas2D, WebGL/WebGPU tessellators, or Rust/WASM.
 */
export enum PathCmd {
  MOVE_TO = 0,
  LINE_TO = 1,
  QUAD_TO = 2,
  CUBIC_TO = 3,
  CONIC_TO = 4,
  CLOSE = 5,
  ARC = 6,
}

export enum BlendMode {
  NORMAL = 0,
  MULTIPLY = 1,
  SCREEN = 2,
  OVERLAY = 3,
  DARKEN = 4,
  LIGHTEN = 5,
  COLOR_DODGE = 6,
  COLOR_BURN = 7,
  HARD_LIGHT = 8,
  SOFT_LIGHT = 9,
  DIFFERENCE = 10,
  EXCLUSION = 11,
  ADD = 12,
  SUBTRACT = 13,
  HUE = 14,
  SATURATION = 15,
  COLOR = 16,
  LUMINOSITY = 17,
}

export enum LineCap {
  BUTT = 0,
  ROUND = 1,
  SQUARE = 2,
}

export enum LineJoin {
  MITER = 0,
  ROUND = 1,
  BEVEL = 2,
}

export enum ShaderType {
  LINEAR_GRADIENT = 0,
  RADIAL_GRADIENT = 1,
  CONIC_GRADIENT = 2,
  IMAGE = 3,
  RUNTIME_EFFECT = 4,
}

export interface GradientStop {
  offset: number
  color: number
}

export interface GradientShader {
  readonly type:
    | ShaderType.LINEAR_GRADIENT
    | ShaderType.RADIAL_GRADIENT
    | ShaderType.CONIC_GRADIENT
  readonly stops: readonly GradientStop[]
  /**
   * Linear: [x0, y0, x1, y1]
   * Radial: [x0, y0, r0, x1, y1, r1]
   * Conic: [cx, cy, angle]
   */
  readonly coords: Float32Array
}

export interface ImageShader {
  readonly type: ShaderType.IMAGE
  readonly imageId: string
  readonly transform?: Float32Array
  readonly repetition?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat'
}

export interface RuntimeEffectShader {
  readonly type: ShaderType.RUNTIME_EFFECT
  readonly effectId: string
  readonly uniforms?: Float32Array
}

export type Shader = GradientShader | ImageShader | RuntimeEffectShader

export interface ShaderRef {
  readonly id: number
}

export enum PaintStyle {
  Fill = 'fill',
  Stroke = 'stroke',
}

export interface StrokeStyle {
  readonly width: number
  readonly cap?: LineCap
  readonly join?: LineJoin
  readonly miterLimit?: number
  readonly dash?: readonly number[]
  readonly dashOffset?: number
}

export interface PaintEffect {
  readonly type: 'drop-shadow' | 'inner-shadow' | 'blur'
  readonly offsetX?: number
  readonly offsetY?: number
  readonly blur?: number
  readonly color?: number
}

export interface Paint {
  readonly style: PaintStyle
  readonly color?: number
  readonly shader?: ShaderRef
  readonly alpha?: number
  readonly blendMode?: BlendMode
  readonly stroke?: StrokeStyle
  readonly effects?: readonly PaintEffect[]
}

export enum RenderBackendType {
  Canvas2D = 'canvas2d',
  WebGL = 'webgl',
  WebGL2 = 'webgl2',
  WebGPU = 'webgpu',
  CanvasKit = 'canvaskit',
  Wasm = 'wasm',
}

export type HtmlCanvasRenderSurface = {
  readonly type: 'html-canvas'
  readonly canvas: HTMLCanvasElement
}

export type OffscreenCanvasRenderSurface = {
  readonly type: 'offscreen-canvas'
  readonly canvas: OffscreenCanvas
}

export type WasmRenderSurface = {
  readonly type: 'wasm-surface'
  readonly handle: number
}

export type RenderSurface =
  | HtmlCanvasRenderSurface
  | OffscreenCanvasRenderSurface
  | WasmRenderSurface

export interface RenderSurfaceSize {
  /**
   * CSS-space width and height. The backend owns backing-store scaling.
   */
  readonly width: number
  readonly height: number
  readonly dpr: number
}

export interface RenderBackendOptions {
  readonly dpr?: number
}

export interface RenderCapabilities {
  readonly conicGradient: boolean
  readonly softShadow: boolean
  readonly offscreenSurface: boolean
  readonly pathHitTest: boolean
  readonly clipPath: boolean
  readonly textBasic: boolean
  readonly textShaping: boolean
  readonly image: boolean
  readonly imageShader: boolean
  readonly runtimeEffect: boolean
  readonly blendModes: ReadonlySet<BlendMode>
}

export const DEFAULT_RENDER_CAPABILITIES: RenderCapabilities = {
  conicGradient: false,
  softShadow: false,
  offscreenSurface: false,
  pathHitTest: false,
  clipPath: false,
  textBasic: false,
  textShaping: false,
  image: false,
  imageShader: false,
  runtimeEffect: false,
  blendModes: new Set([BlendMode.NORMAL]),
}

export interface RenderPassClear {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color?: number
}

export interface RenderPass {
  readonly clear?: RenderPassClear
}

export enum RenderCommandType {
  DrawRect = 'draw-rect',
  DrawEllipse = 'draw-ellipse',
  DrawPath = 'draw-path',
  DrawText = 'draw-text',
  DrawImage = 'draw-image',
  PushClipRect = 'push-clip-rect',
  PushClipPath = 'push-clip-path',
  PushLayer = 'push-layer',
  Pop = 'pop',
}

export interface RenderCommandBase {
  readonly type: RenderCommandType
}

export interface TransformedRenderCommand extends RenderCommandBase {
  readonly transform: Float32Array
}

export interface DrawGeometryCommand extends TransformedRenderCommand {
  readonly paint: Paint
}

export interface DrawRectCommand extends DrawGeometryCommand {
  readonly type: RenderCommandType.DrawRect
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly cornerRadius: number | Float32Array
}

export interface DrawEllipseCommand extends DrawGeometryCommand {
  readonly type: RenderCommandType.DrawEllipse
  readonly cx: number
  readonly cy: number
  readonly rx: number
  readonly ry: number
  readonly rotation: number
}

export interface DrawPathCommand extends DrawGeometryCommand {
  readonly type: RenderCommandType.DrawPath
  readonly pathId: number
}

export interface DrawTextCommand extends TransformedRenderCommand {
  readonly type: RenderCommandType.DrawText
  readonly text: string
  readonly x: number
  readonly y: number
  readonly fontId: string
  readonly fontSize: number
  readonly paint: Paint
  readonly align?: 'left' | 'center' | 'right'
  readonly baseline?: 'top' | 'middle' | 'bottom' | 'alphabetic'
  readonly maxWidth?: number
}

export interface DrawImageCommand extends TransformedRenderCommand {
  readonly type: RenderCommandType.DrawImage
  readonly imageId: string
  readonly dx: number
  readonly dy: number
  readonly dw: number
  readonly dh: number
  readonly sx?: number
  readonly sy?: number
  readonly sw?: number
  readonly sh?: number
  readonly paint?: Paint
}

export interface PushClipRectCommand extends TransformedRenderCommand {
  readonly type: RenderCommandType.PushClipRect
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface PushClipPathCommand extends TransformedRenderCommand {
  readonly type: RenderCommandType.PushClipPath
  readonly pathId: number
}

export interface PushLayerCommand extends RenderCommandBase {
  readonly type: RenderCommandType.PushLayer
  readonly alpha?: number
  readonly blendMode?: BlendMode
  readonly bounds?: RenderPassClear
}

export interface PopCommand extends RenderCommandBase {
  readonly type: RenderCommandType.Pop
}

export type RenderCommand =
  | DrawRectCommand
  | DrawEllipseCommand
  | DrawPathCommand
  | DrawTextCommand
  | DrawImageCommand
  | PushClipRectCommand
  | PushClipPathCommand
  | PushLayerCommand
  | PopCommand

export class RenderCommandBuffer {
  private readonly _commands: RenderCommand[] = []
  private readonly _shaders = new Map<number, Shader>()
  private _shaderId = 1
  private _pass: RenderPass = {}

  public get commands(): readonly RenderCommand[] {
    return this._commands
  }

  public get shaders(): ReadonlyMap<number, Shader> {
    return this._shaders
  }

  public get pass(): RenderPass {
    return this._pass
  }

  public setClear(clear: RenderPassClear) {
    this._pass = { ...this._pass, clear }
  }

  public push(command: RenderCommand) {
    this._commands.push(command)
  }

  public createShader(shader: Shader): ShaderRef {
    const id = this._shaderId++
    this._shaders.set(id, shader)
    return { id }
  }

  public getShader(id: number) {
    return this._shaders.get(id) ?? null
  }

  public reset() {
    this._commands.length = 0
    this._shaders.clear()
    this._shaderId = 1
    this._pass = {}
  }
}

export interface IRenderCommandEncoder {
  createShader(shader: Shader): ShaderRef
  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    cornerRadius: number | Float32Array,
    paint: Paint
  ): void
  drawEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rotation: number,
    paint: Paint
  ): void
  drawPath(pathId: number, paint: Paint): void
  drawText(
    text: string,
    x: number,
    y: number,
    fontId: string,
    fontSize: number,
    paint: Paint,
    align?: 'left' | 'center' | 'right',
    baseline?: 'top' | 'middle' | 'bottom' | 'alphabetic',
    maxWidth?: number
  ): void
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
    paint?: Paint
  ): void
  pushClipRect(x: number, y: number, width: number, height: number): void
  pushClipPath(pathId: number): void
  pushLayer(
    alpha?: number,
    blendMode?: BlendMode,
    bounds?: RenderPassClear
  ): void
  pop(): void
}

export interface RenderStats {
  drawCalls: number
  triangles: number
  vertices: number
  textures: number
}

export interface IRenderBackendDriver {
  readonly type: RenderBackendType | string
  readonly capabilities: RenderCapabilities
  init(
    surface: RenderSurface,
    options?: RenderBackendOptions
  ): void | Promise<void>
  resize(size: RenderSurfaceSize): void
  submit(commandBuffer: RenderCommandBuffer): void
  getSize(): RenderSurfaceSize
  dispose(): void
  getStats(): RenderStats
  resetStats(): void
}

export interface PathResourceManager {
  createPath(commands: Uint8Array, data: Float32Array): number
  deletePath(pathId: number): void
}

export interface ImageResourceManager {
  uploadImage(imageId: string, source: TexImageSource): Promise<void>
  deleteImage(imageId: string): void
}

export interface TextMeasureBackend {
  measureText(
    text: string,
    fontId: string,
    fontSize: number
  ): {
    width: number
    height: number
    actualBoundingBoxAscent?: number
    actualBoundingBoxDescent?: number
  }
}

export interface RenderSurfaceManager {
  createOffscreenSurface(
    width: number,
    height: number,
    samples?: number
  ): number
  deleteOffscreenSurface(surfaceId: number): void
  setSurface(surfaceId: number | null): void
  blitSurface(
    surfaceId: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void
}

export interface PathHitTestBackend {
  isPointInPath(
    pathId: number,
    x: number,
    y: number,
    transform?: Float32Array,
    fillRule?: 'nonzero' | 'evenodd'
  ): boolean
  isPointInStroke(
    pathId: number,
    x: number,
    y: number,
    transform?: Float32Array,
    strokeWidth?: number
  ): boolean
}
