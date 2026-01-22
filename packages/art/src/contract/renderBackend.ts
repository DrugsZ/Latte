/**
 * Path command enumeration for drawPath
 * Maps to Canvas API actions
 */
export enum PathCmd {
  MOVE_TO = 0,
  LINE_TO = 1,
  QUAD_TO = 2, // Quadratic Bezier
  CUBIC_TO = 3, // Cubic Bezier
  CLOSE = 4,
  ARC = 5, // Arc
}

/**
 * Blending mode enumeration
 * Maps to Canvas globalCompositeOperation and WebGL blending
 */
export enum BlendMode {
  NORMAL = 0, // source-over
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
  ADD = 12, // lighter
  SUBTRACT = 13,
}

/**
 * Line cap styles
 */
export enum LineCap {
  BUTT = 0,
  ROUND = 1,
  SQUARE = 2,
}

/**
 * Line join styles
 */
export enum LineJoin {
  MITER = 0,
  ROUND = 1,
  BEVEL = 2,
}

/**
 * Gradient types
 */
export enum GradientType {
  LINEAR = 0,
  RADIAL = 1,
  CONIC = 2,
}

/**
 * Gradient color stop
 */
export interface GradientStop {
  offset: number // 0.0 - 1.0
  color: number // 0xRRGGBBAA format
}

/**
 * Text measurement results
 */
export interface TextMetrics {
  width: number
  height: number
  actualBoundingBoxAscent?: number
  actualBoundingBoxDescent?: number
}

/**
 * Gradient definition
 */
export interface Gradient {
  type: GradientType
  stops: GradientStop[]
  // Linear: [x0, y0, x1, y1]
  // Radial: [x0, y0, r0, x1, y1, r1]
  // Conic: [cx, cy, angle]
  coords: Float32Array
}

/**
 * Abstract interface for canvas-like objects (HTMLCanvasElement, OffscreenCanvas, Node-Canvas)
 */
export interface CanvasLike {
  width: number
  height: number
  getContext(
    contextId: '2d',
    options?: CanvasRenderingContext2DSettings
  ): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  toDataURL?(type?: string, encoderOptions?: number): string
  toBlob?(
    callback: (blob: Blob | null) => void,
    type?: string,
    quality?: number
  ): void
  convertToBlob?(options?: { type?: string; quality?: number }): Promise<Blob>
}

export interface IRenderBackend {
  // ==========================================
  // 1. Lifecycle
  // ==========================================

  /**
   * Initialize the backend with a canvas instance
   * @param canvas The canvas element or offscreen canvas
   * @param dpr Initial device pixel ratio
   */
  init(canvas: CanvasLike, dpr?: number): void

  /**
   * Respond to canvas size changes
   * @param width Physical width (css width * dpr)
   * @param height Physical height
   * @param dpr Device pixel ratio
   */
  resize(width: number, height: number, dpr: number): void

  clearRect(x: number, y: number, w: number, h: number): void

  getWidth(): number

  getHeight(): number

  /**
   * Destroy resources (unbind events, release WebGL context, etc.)
   */
  dispose(): void

  // ==========================================
  // 2. Frame Control
  // ==========================================

  /**
   * Start a new frame
   * Clears the canvas, resets batch buffers, and state stack
   */
  beginFrame(): void

  /**
   * End the current frame
   * Submits remaining batches (WebGL) or performs cleanup
   */
  endFrame(): void

  // ==========================================
  // 3. State Management
  // ==========================================

  /**
   * Set absolute transform matrix
   * @param matrix [a, b, c, d, tx, ty]
   */
  setTransform(matrix: Float32Array): void

  /**
   * Reset transform to identity matrix
   */
  resetTransform(): void

  /**
   * Set global alpha
   * @param alpha 0.0 - 1.0
   *
   * Note: Alpha is typically hierarchical (parent 0.5 * child 0.5 = 0.25).
   * Either the renderer calculates final alpha, or the backend maintains an alpha stack.
   */
  setGlobalAlpha(alpha: number): void

  /**
   * Push clipping region (Masking)
   */
  pushClip(x: number, y: number, w: number, h: number): void

  /**
   * Pop clipping region
   */
  popClip(): void

  /**
   * Set blending mode
   * @param mode Blending mode enum
   */
  setBlendMode(mode: BlendMode): void

  /**
   * Set shadow parameters
   * @param offsetX Shadow offset X
   * @param offsetY Shadow offset Y
   * @param blur Blur radius
   * @param color Shadow color (0xRRGGBBAA)
   * @returns boolean indicating if the feature is supported
   */
  setShadow(
    offsetX: number,
    offsetY: number,
    blur: number,
    color: number
  ): boolean

  /**
   * Clear shadow settings
   */
  clearShadow(): void

  /**
   * Set line style parameters
   * @param width Stroke width
   * @param cap Line cap style
   * @param join Line join style
   * @param miterLimit Miter limit (only for MITER join)
   */
  setLineStyle(
    width: number,
    cap: LineCap,
    join: LineJoin,
    miterLimit?: number
  ): void

  /**
   * Set line dash pattern
   * @param segments Dash segments (e.g., [5, 10] for 5px dash, 10px gap)
   * @param offset Dash offset
   */
  setLineDash(segments: number[], offset?: number): void

  /**
   * Clear line dash pattern
   */
  clearLineDash(): void

  /**
   * Draw a rectangle (supports rounded corners)
   * @param cornerRadius Corner radius or per-corner radii [tl, tr, br, bl]
   * @param fill Fill color or gradient ID
   * @param stroke Stroke color or gradient ID
   */
  drawRect(
    x: number,
    y: number,
    w: number,
    h: number,
    cornerRadius: number | Float32Array,
    fill?: number,
    stroke?: number,
    strokeWidth?: number
  ): void

  /**
   * Draw an ellipse or circle
   */
  drawEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rotation: number,
    fill?: number,
    stroke?: number,
    strokeWidth?: number
  ): void

  // ==========================================
  // 4. Vector Paths
  // ==========================================

  /**
   * Create a path resource
   * @returns Unique path ID
   */
  createPath(commands: Uint8Array, data: Float32Array): number

  /**
   * Delete a path resource
   */
  deletePath(pathId: number): void

  /**
   * Draw a vector path
   * @param pathId Resource ID of the path
   */
  drawPath(
    pathId: number,
    fill?: number,
    stroke?: number,
    strokeWidth?: number
  ): void

  // ==========================================
  // 5. Advanced Objects
  // ==========================================

  /**
   * Draw text
   * @param text Text content
   * @param fontId Font resource ID
   * @param fontSize Font size
   * @param fill Fill color or gradient
   * @param align Horizontal alignment
   * @param baseline Vertical alignment baseline
   *
   * Note: Text rendering is complex. Canvas2D supports it natively;
   * WebGL/WebGPU requires Glyph Atlas or SDF implementation.
   */
  drawText(
    text: string,
    x: number,
    y: number,
    fontId: string,
    fontSize: number,
    fill?: number,
    stroke?: number,
    strokeWidth?: number,
    align?: 'left' | 'center' | 'right',
    baseline?: 'top' | 'middle' | 'bottom' | 'alphabetic',
    maxWidth?: number
  ): void

  /**
   * Measure text dimensions
   * @returns Text metrics for layout calculation
   */
  measureText(text: string, fontId: string, fontSize: number): TextMetrics

  /**
   * Draw an image
   * @param imageId Image resource ID
   * @param dx Destination X
   * @param dy Destination Y
   * @param dw Destination width
   * @param dh Destination height
   * @param sx Source X (for sprite/cropping)
   * @param sy Source Y
   * @param sw Source width
   * @param sh Source height
   * @param opacity Opacity (0-1)
   */
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
    opacity?: number
  ): void

  /**
   * Draw a rectangle with pattern fill
   * @param imageId Pattern image resource ID
   * @param repetition Pattern repetition mode
   */
  drawPattern(
    x: number,
    y: number,
    w: number,
    h: number,
    imageId: string,
    repetition: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat'
  ): void

  // ==========================================
  // 6. Resource Management
  // ==========================================

  /**
   * Create a gradient resource
   * @returns Unique gradient ID
   */
  createGradient(gradient: Gradient): number

  /**
   * Delete a gradient resource
   */
  deleteGradient(gradientId: number): void

  /**
   * Upload image source to GPU (async)
   * @param imageId Image ID
   * @param source Image source (HTMLImageElement, Canvas, etc.)
   */
  uploadImage(imageId: string, source: TexImageSource): Promise<void>

  /**
   * Delete an image resource
   */
  deleteImage(imageId: string): void

  // ==========================================
  // 7. Offscreen Rendering & Post-processing
  // ==========================================

  /**
   * Create an offscreen render target (FBO / OffscreenCanvas)
   * @param width Target width
   * @param height Target height
   * @param samples MSAA sample count (WebGL/WebGPU only)
   * @returns Target ID
   */
  createRenderTarget(width: number, height: number, samples?: number): number

  /**
   * Delete a render target
   */
  deleteRenderTarget(targetId: number): void

  /**
   * Set current render target (null for main canvas)
   */
  setRenderTarget(targetId: number | null): void

  /**
   * Blit a render target to the current destination
   * @param targetId Source target ID
   */
  blitRenderTarget(
    targetId: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void

  // ==========================================
  // 8. Performance & Debugging
  // ==========================================

  /**
   * Get rendering statistics
   */
  getStats(): {
    drawCalls: number
    triangles: number
    vertices: number
    textures: number
  }

  /**
   * Reset rendering statistics
   */
  resetStats(): void

  /**
   * Draw a debug bounding box
   */
  drawDebugRect(x: number, y: number, w: number, h: number, color: number): void

  // ==========================================
  // 9. Interaction Support
  // ==========================================

  /**
   * Hit test: check if a point is within a path
   * @param pathId Resource ID
   * @param x Coordinate X
   * @param y Coordinate Y
   * @param transform Path transformation matrix
   * @param fillRule Fill rule for hit testing
   */
  isPointInPath(
    pathId: number,
    x: number,
    y: number,
    transform?: Float32Array,
    fillRule?: 'nonzero' | 'evenodd'
  ): boolean

  /**
   * Hit test: check if a point is on the path stroke
   */
  isPointInStroke(
    pathId: number,
    x: number,
    y: number,
    transform?: Float32Array,
    strokeWidth?: number
  ): boolean

  /**
   * Get backend type identifier
   * @returns 'canvas2d' | 'webgl' | 'webgl2' | 'webgpu'
   */
  getBackendType(): string
}
