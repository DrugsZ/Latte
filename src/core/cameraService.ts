import { Point } from 'Latte/common/Point'
import { Emitter } from 'Latte/common/event'
import { Matrix } from 'Latte/math/matrix'

export class Camera {
  private _zoom: number = 1
  private _viewport: {
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

  setZoom(value: number, viewPortPoint?: IPoint) {
    const oldMatrix = this._matrix.clone()
    this._zoom = value
    this._updateMatrix()
    if (viewPortPoint) {
      this._adjustPosition(oldMatrix, viewPortPoint)
    }
  }

  private _adjustPosition(preMatrix: IMatrixLike, viewPortPoint: IPoint) {
    const newViewPort = Matrix.applyMatrixInvertToPoint(
      this._matrix,
      Matrix.apply(viewPortPoint, preMatrix)
    )
    const newMove = {
      x: newViewPort.x - viewPortPoint.x,
      y: newViewPort.y - viewPortPoint.y,
    }
    this.move(-newMove.x, -newMove.y)
  }

  private _updateMatrix() {
    const tx = this._viewport.width / 2 - this._position.x / this._zoom
    const ty = this._viewport.height / 2 - this._position.y / this._zoom
    this._matrix.a = 1 / this._zoom
    this._matrix.b = 0
    this._matrix.c = 0
    this._matrix.d = 1 / this._zoom
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
    const renderWidth = this._viewport.width * this._zoom
    const renderHeight = this._viewport.height * this._zoom
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

class CameraService<T = any> {
  private _cameraMaps: Map<T, Camera> = new Map()

  private readonly _onCameraViewChange = new Emitter<Camera>()
  public readonly onCameraViewChange = this._onCameraViewChange.event
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

    const newCamera = new Camera(fullSize, 1 / minRatio)
    newCamera.setPosition(viewportCenterX, viewportCenterY)
    this._cameraMaps.set(id, newCamera)
    newCamera.onCameraViewChange(event => {
      this._onCameraViewChange.fire(event)
    })
    return newCamera
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
}

export default CameraService
