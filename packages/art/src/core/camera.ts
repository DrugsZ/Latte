import { mat2d, vec2 } from 'gl-matrix' // Recommended to use gl-matrix library or create your own wrapper

export class Camera {
  // --- Core State ---
  private _zoom: number = 1
  private _position = vec2.fromValues(0, 0) // Camera center point in world coordinates

  // --- Cache (Dirty Pattern) ---
  private _matrixDirty = true
  private _matrix = mat2d.create() // World -> Screen matrix (for rendering)
  private _invMatrix = mat2d.create() // Screen -> World matrix (for hit testing)

  // --- Configuration Limits ---
  private _MIN_ZOOM = 0.05 // 5%
  private _MAX_ZOOM = 256 // 25600%

  constructor(
    private _viewportWidth: number,
    private _viewportHeight: number
  ) {
    this._updateMatrix()
  }

  // ==========================================
  // 1. Viewport Management (Resize)
  // ==========================================

  public resize(w: number, h: number) {
    this._viewportWidth = w
    this._viewportHeight = h
    this._matrixDirty = true
  }

  // ==========================================
  // 2. Core Interactions (Pan & Zoom)
  // ==========================================

  /**
   * Pan the camera
   * @param dx Screen pixel delta X
   * @param dy Screen pixel delta Y
   */
  public pan(dx: number, dy: number) {
    // Moving screen by dx is equivalent to moving camera in world by -dx / zoom
    // Or directly modify matrix tx, ty
    // Here we maintain the position concept, i.e., world coordinates corresponding to viewport center
    const worldDx = dx / this._zoom
    const worldDy = dy / this._zoom

    this._position[0] -= worldDx
    this._position[1] -= worldDy

    this._matrixDirty = true
  }

  /**
   * Zoom at a specific point
   * This is one of the most challenging logic in editors
   * @param factor Zoom factor (1.1 to zoom in, 0.9 to zoom out)
   * @param centerScreenX Mouse screen coordinate X
   * @param centerScreenY Mouse screen coordinate Y
   */
  public zoomAt(factor: number, centerScreenX: number, centerScreenY: number) {
    const oldZoom = this._zoom
    const newZoom = Math.min(
      Math.max(oldZoom * factor, this._MIN_ZOOM),
      this._MAX_ZOOM
    )

    if (newZoom === oldZoom) return

    // 1. Calculate mouse position in world coordinates (World Point)
    // Using the current inverse matrix
    const mouseWorld = this.toWorld(centerScreenX, centerScreenY)

    // 2. Update Zoom
    this._zoom = newZoom

    // 3. Compensate Translation
    // Logic: After zooming, the world coordinate pointed by the mouse should remain at the same screen position
    // New screen position = (World - NewPos) * NewZoom + CenterOffset
    // The derivation is complex, a simplified approach:
    // Camera needs to move, movement distance = mouse world coordinate * (zoom difference)

    // More intuitive algorithm: directly manipulate matrix (not maintaining position, only matrix) is often simpler
    // But for clarity, we update position here

    // Viewport center
    const cx = this._viewportWidth / 2
    const cy = this._viewportHeight / 2

    // Mouse offset relative to center
    const offsetX = centerScreenX - cx
    const offsetY = centerScreenY - cy

    // Core formula:
    // newPos = mouseWorld - (mouseOffset / newZoom)
    this._position[0] = mouseWorld.x - offsetX / newZoom
    this._position[1] = mouseWorld.y - offsetY / newZoom

    this._matrixDirty = true
  }

  // ==========================================
  // 3. Matrix Calculation (Lazy Evaluation)
  // ==========================================

  public getMatrix(): mat2d {
    if (this._matrixDirty) {
      this._updateMatrix()
    }
    return this._matrix
  }

  /**
   * Update matrix cache
   * Transform order: Translate(Center) -> Scale(Zoom) -> Translate(-Position)
   */
  private _updateMatrix() {
    const cx = this._viewportWidth / 2
    const cy = this._viewportHeight / 2

    mat2d.identity(this._matrix)

    // 1. Move to screen center
    mat2d.translate(this._matrix, this._matrix, [cx, cy])

    // 2. Scale
    mat2d.scale(this._matrix, this._matrix, [this._zoom, this._zoom])

    // 3. Move back to camera position
    mat2d.translate(this._matrix, this._matrix, [
      -this._position[0],
      -this._position[1],
    ])

    // 4. Synchronize inverse matrix update (for HitTest)
    mat2d.invert(this._invMatrix, this._matrix)

    this._matrixDirty = false
  }

  // ==========================================
  // 4. Coordinate Transformation (Helpers)
  // ==========================================

  /**
   * Screen -> World (for hit testing)
   */
  public toWorld(screenX: number, screenY: number) {
    if (this._matrixDirty) this._updateMatrix()
    const v = vec2.fromValues(screenX, screenY)
    vec2.transformMat2d(v, v, this._invMatrix)
    return { x: v[0], y: v[1] }
  }

  /**
   * World -> Screen (for UI Overlay following)
   */
  public toScreen(worldX: number, worldY: number) {
    if (this._matrixDirty) this._updateMatrix()
    const v = vec2.fromValues(worldX, worldY)
    vec2.transformMat2d(v, v, this._matrix)
    return { x: v[0], y: v[1] }
  }

  /**
   * Get current viewport world bounding box (for Culling)
   */
  public getViewportBounds() {
    const tl = this.toWorld(0, 0)
    const br = this.toWorld(this._viewportWidth, this._viewportHeight)
    return {
      minX: tl.x,
      minY: tl.y,
      maxX: br.x,
      maxY: br.y,
    }
  }

  // ==========================================
  // 5. Utility Methods (Utilities)
  // ==========================================

  /**
   * Initialize Viewport
   * Set Canvas size and world region to display in one go
   * @param worldX World region start X
   * @param worldY World region start Y
   * @param worldWidth World region width
   * @param worldHeight World region height
   * @param padding Padding (between 0-1, default 0)
   *
   * @example
   * // Canvas 500x500, display world coordinates from [1000,1000] to [2000,2000]
   * camera.initViewport(500, 500, 1000, 1000, 1000, 1000)
   */
  initViewport(
    worldX: number,
    worldY: number,
    worldWidth: number,
    worldHeight: number,
    padding: number = 0
  ) {
    this.fitBounds(
      worldX,
      worldY,
      worldX + worldWidth,
      worldY + worldHeight,
      padding
    )
  }

  /**
   * Set World Viewport
   * Fit specified world coordinate range to current canvas size
   * @param worldWidth World width to display
   * @param worldHeight World height to display
   * @param centerX World center point X (default: worldWidth/2)
   * @param centerY World center point Y (default: worldHeight/2)
   */
  public setWorldViewport(
    worldWidth: number,
    worldHeight: number,
    centerX?: number,
    centerY?: number
  ) {
    // Calculate required zoom ratio (take smaller value to ensure complete display)
    const scaleX = this._viewportWidth / worldWidth
    const scaleY = this._viewportHeight / worldHeight
    this._zoom = Math.min(scaleX, scaleY)

    // Clamp within allowed range
    this._zoom = Math.min(Math.max(this._zoom, this._MIN_ZOOM), this._MAX_ZOOM)

    // Set camera position to world center
    this._position[0] = centerX ?? worldWidth / 2
    this._position[1] = centerY ?? worldHeight / 2

    this._matrixDirty = true
  }

  /**
   * Fit World Bounding Box
   * @param minX World bounding box min X
   * @param minY World bounding box min Y
   * @param maxX World bounding box max X
   * @param maxY World bounding box max Y
   * @param padding Padding (between 0-1, 0.1 means 10% padding)
   */
  public fitBounds(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    padding: number = 0.1
  ) {
    const worldWidth = maxX - minX
    const worldHeight = maxY - minY

    // Apply padding
    const paddedWidth = worldWidth * (1 + padding * 2)
    const paddedHeight = worldHeight * (1 + padding * 2)

    // Calculate center point
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    this.setWorldViewport(paddedWidth, paddedHeight, centerX, centerY)
  }

  /**
   * Set zoom level directly
   */
  public setZoom(zoom: number) {
    this._zoom = Math.min(Math.max(zoom, this._MIN_ZOOM), this._MAX_ZOOM)
    this._matrixDirty = true
  }

  /**
   * Get current zoom level
   */
  public getZoom(): number {
    return this._zoom
  }

  /**
   * Set camera position directly
   */
  public setPosition(x: number, y: number) {
    this._position[0] = x
    this._position[1] = y
    this._matrixDirty = true
  }

  /**
   * Get current camera position
   */
  public getPosition(): { x: number; y: number } {
    return { x: this._position[0], y: this._position[1] }
  }
}
