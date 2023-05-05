import { Emitter } from 'Cditor/common/event'

export class Camera {
  private _zoom: number = 1
  private _viewport: Rectangle

  constructor(size: Rectangle, zoom: number = 1) {
    this._viewport = size
    this._zoom = zoom
  }

  private readonly _onCameraViewChange = new Emitter<Camera>()
  public readonly onCameraViewChange = this._onCameraViewChange.event

  getZoom() {
    return this._zoom
  }

  setZoom(value: number) {
    this._zoom = value
    this._onCameraViewChange.fire(this)
  }

  getViewport() {
    return this._viewport
  }

  setViewport(size: Rectangle) {
    this._viewport = { ...this._viewport, ...size }
    this._onCameraViewChange.fire(this)
  }

  move(x: number, y: number) {
    const { x: oldX, y: oldY } = this._viewport
    this.setViewport({
      ...this._viewport,
      x: oldX - x,
      y: oldY - y,
    })
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
    const currentZoom = minRatio
    const canRenderWidth = fullWidth / minRatio
    const canRenderHeight = fullHeight / minRatio
    const paddingWidth = canRenderWidth - size.width
    const paddingHeight = canRenderHeight - size.height

    const currentSize = {
      ...size,
      x: size.x - paddingWidth / 2,
      y: size.y - paddingHeight / 2,
    }

    const newCamera = new Camera(currentSize, currentZoom)
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
  getZoom(id: T) {
    if (!this._cameraMaps.has(id)) {
      throw Error(`can not found camera by id: ${id}`)
    }
    const result = this._cameraMaps.get(id)
    return result!.getZoom()
  }

  getCamera(id: T) {
    if (!this._cameraMaps.has(id)) {
      throw Error(`can not found camera by id: ${id}`)
    }
    return this._cameraMaps.get(id) as Camera
  }
}

export default CameraService
