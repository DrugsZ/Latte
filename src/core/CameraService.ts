import { Point } from 'Latte/common/Point'
import { Emitter } from 'Latte/common/event'

export class Camera {
  private _zoom: number = 1
  private _viewport: {
    width: number
    height: number
  }
  private _position: Point
  private _matrix = new Float32Array(6)

  constructor(
    size: {
      width: number
      height: number
    },
    zoom: number = 1
  ) {
    this._viewport = {
      ...size,
    }
    this._zoom = zoom
    this._position = new Point(size.width / 2, size.height / 2)
  }

  private readonly _onCameraViewChange = new Emitter<Camera>()
  public readonly onCameraViewChange = this._onCameraViewChange.event

  setZoom(value: number) {
    this._zoom = value
    this._updateMatrix()
  }

  private _updateMatrix() {
    const tx = this._viewport.width / 2 - this._position.x * this._zoom
    const ty = this._viewport.height / 2 - this._position.y * this._zoom
    this._matrix[0] = this._zoom
    this._matrix[1] = 0
    this._matrix[2] = 0
    this._matrix[3] = this._zoom
    this._matrix[4] = tx
    this._matrix[5] = ty
    this._onCameraViewChange.fire(this)
  }

  move(x: number, y: number) {
    this._position.x += x
    this._position.y += y
    this._updateMatrix()
  }

  setPosition(x: number, y: number) {
    this._position.x = x
    this._position.y = y
    this._updateMatrix()
  }

  getViewPortMatrix() {
    return this._matrix
  }

  getViewport(): Rectangle {
    return {
      x: this._matrix[4],
      y: this._matrix[5],
      width: this._zoom * this._viewport.width,
      height: this._zoom * this._viewport.height,
    }
  }
}

class CameraService<T = any> {
  private _cameraMaps: Map<T, Camera> = new Map()
  constructor(
    public fullSize: {
      width: number
      height: number
    }
  ) {}

  public createCamera(
    id: T,
    options: {
      size: Rectangle
      padding: number
    }
  ) {
    const { fullSize } = this
    const { size, padding = 0 } = options
    const { width, height } = size
    const { width: fullWidth, height: fullHeight } = fullSize
    const widthRatio = (fullWidth * (1 - padding)) / width
    const heightRatio = (fullHeight * (1 - padding)) / height
    const minRatio = Math.min(widthRatio, heightRatio)
    const viewportCenterX = size.x + width / 2
    const viewportCenterY = size.y + height / 2

    const newCamera = new Camera(fullSize, minRatio)
    newCamera.setPosition(viewportCenterX, viewportCenterY)
    this._cameraMaps.set(id, newCamera)
    return newCamera
  }
  getViewport(id: T) {
    if (!this._cameraMaps.has(id)) {
      throw Error(`can not found camera by id: ${id}`)
    }
    const result = this._cameraMaps.get(id)
    return result!.getViewport()
  }

  getCamera(id: T) {
    if (!this._cameraMaps.has(id)) {
      throw Error(`can not found camera by id: ${id}`)
    }
    return this._cameraMaps.get(id) as Camera
  }
}

export default CameraService
