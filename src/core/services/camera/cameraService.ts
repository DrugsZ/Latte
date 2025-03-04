import { Point } from 'Latte/common/point'
import { Emitter } from 'Latte/common/event'
import { Matrix } from 'Latte/core/utils/matrix'
import { Vector } from 'Latte/common/vector'

import { MAX_ZOOM, MIN_ZOOM } from 'Latte/assets/constant'
import { Disposable } from 'Latte/core/services/lifecycle/lifecycleService'

export class Camera {
  private _zoom = 1
  private _physicalViewport: {
    width: number
    height: number
  }
  private _position: Point
  private _matrix = new Matrix()

  constructor(
    size: {
      width: number
      height: number
    },
    zoom = 1
  ) {
    this._physicalViewport = {
      ...size,
    }
    this._setZoomValue(zoom)
    this._position = new Point(size.width / 2, size.height / 2)
  }

  private readonly _onCameraViewChange = new Emitter<Camera>()
  public readonly onCameraViewChange = this._onCameraViewChange.event

  setZoom(value: number, viewPortPoint?: ReadonlyVec2) {
    const oldMatrix = this._matrix.clone()
    if (!this._setZoomValue(value)) {
      return
    }
    // _adjustPosition will call _updateMatrix. After the matrix update completes,
    // the cameraViewChange event will be triggered. To ensure execution order,
    // use an async queue when invoking _updateMatrix if necessary.
    if (viewPortPoint) {
      this._adjustPosition(oldMatrix, viewPortPoint)
    } else {
      this._updateMatrix()
    }
  }

  private _setZoomValue(value: number) {
    const newZoom = Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM)
    if (newZoom === this._zoom) {
      return false
    }
    this._zoom = newZoom
    return true
  }

  private _adjustPosition(preMatrix: IMatrixLike, viewPortPoint: ReadonlyVec2) {
    const newViewPort = Matrix.applyMatrixInvertToPoint(
      this._matrix,
      Matrix.apply(viewPortPoint, preMatrix)
    )
    const newMove = Vector.subtract(newViewPort, viewPortPoint)
    this.move(-newMove[0], -newMove[1])
  }

  private _updateMatrix() {
    const tx = this._physicalViewport.width / 2 - this._position.x * this._zoom
    const ty = this._physicalViewport.height / 2 - this._position.y * this._zoom
    this._matrix.a = 1 * this._zoom
    this._matrix.b = 0
    this._matrix.c = 0
    this._matrix.d = 1 * this._zoom
    this._matrix.tx = tx
    this._matrix.ty = ty
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
    const renderCenterX = this._position.x
    const renderCenterY = this._position.y
    const renderWidth = this._physicalViewport.width / this._zoom
    const renderHeight = this._physicalViewport.height / this._zoom
    return {
      x: renderCenterX - renderWidth / 2,
      y: renderCenterY - renderHeight / 2,
      width: renderWidth,
      height: renderHeight,
    }
  }

  getZoom() {
    return this._zoom
  }
}

class CameraService<T = any> extends Disposable {
  private _cameraMaps: Map<T, Camera> = new Map()

  private readonly _onCameraViewChange = new Emitter<Camera>()
  public readonly onCameraViewChange = this._onCameraViewChange.event
  constructor(
    public fullSize: {
      width: number
      height: number
    }
  ) {
    super()
  }

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
    newCamera.onCameraViewChange(this._listCameraViewChange)
    return newCamera
  }

  private _listCameraViewChange = event => {
    this._onCameraViewChange.fire(event)
  }
  public getViewport(id: T) {
    if (!this._cameraMaps.has(id)) {
      throw Error(`can not found camera by id: ${id}`)
    }
    const result = this._cameraMaps.get(id)
    return result!.getViewport()
  }

  public getCamera(id: T) {
    if (!this._cameraMaps.has(id)) {
      throw Error(`can not found camera by id: ${id}`)
    }
    return this._cameraMaps.get(id) as Camera
  }

  public override dispose(): void {
    this._cameraMaps.clear()
    super.dispose()
  }
}

export default CameraService
