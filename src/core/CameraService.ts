import { Emitter } from 'Cditor/common/event'
import Page from 'Cditor/core/page'

class Camera {
  private _zoom: number = 1
  private _viewport: Rectangle

  constructor(size: Rectangle, zoom: number = 1) {
    this._viewport = size
    this._zoom = zoom
  }

  private readonly _onCameraViewChange = new Emitter<Rectangle>()
  public readonly onCameraViewChange = this._onCameraViewChange.event

  getZoom() {
    return this._zoom
  }

  setZoom(value: number) {
    this._zoom = value
    this._onCameraViewChange.fire(this._viewport)
  }

  getViewport() {
    return this._viewport
  }

  setViewport(size: Rectangle) {
    this._viewport = { ...this._viewport, ...size }
    this._onCameraViewChange.fire(this._viewport)
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

class CameraService {
  private _cameraMaps: Map<string, Camera> = new Map()
  constructor(
    private _fullSize: {
      width: number
      height: number
    }
  ) {}

  private _initInstanceForPage(page: Page) {
    const size = page.getBoundingClientRect()
    const widthRatio = this._fullSize.width / size.width
    const heightRatio = this._fullSize.height / size.height
    this._cameraMaps.set(
      page.id,
      new Camera(size, Math.min(widthRatio, heightRatio))
    )
  }
  getViewport(page: Page) {
    if (!this._cameraMaps.has(page.id)) {
      this._initInstanceForPage(page)
    }
    const result = this._cameraMaps.get(page.id)
    return result!.getViewport()
  }
  getZoom(page: Page) {
    if (!this._cameraMaps.has(page.id)) {
      this._initInstanceForPage(page)
    }
    const result = this._cameraMaps.get(page.id)
    return result!.getZoom()
  }

  getCamera(page: Page) {
    if (!this._cameraMaps.has(page.id)) {
      this._initInstanceForPage(page)
    }
    return this._cameraMaps.get(page.id) as Camera
  }
}

export default CameraService
