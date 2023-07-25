import { DEFAULT_BACKGROUND_COLOR } from 'Latte/constants'
import type { Camera } from 'Latte/core/CameraService'

class RenderService {
  private _ctx: CanvasRenderingContext2D
  constructor(private readonly _canvas: HTMLCanvasElement) {
    this._ctx = this._canvas.getContext('2d') as CanvasRenderingContext2D
  }

  public getCanvasRenderingContext() {
    return this._ctx
  }

  public prepareRender(camera: Camera) {
    this._ctx.resetTransform()
    this._clearDrawArea()
    const vpMatrix = camera.getViewPortMatrix()
    this._ctx.setTransform(
      vpMatrix.a,
      vpMatrix.b,
      vpMatrix.c,
      vpMatrix.d,
      vpMatrix.tx,
      vpMatrix.ty
    )
  }

  private _clearDrawArea(
    area: Rectangle = {
      x: 0,
      y: 0,
      width: this._canvas.width,
      height: this._canvas.height,
    }
  ) {
    const ctx = this._ctx
    ctx.resetTransform()
    this._canvas.width = area.width
    this._canvas.height = area.height
    ctx.clearRect(area.x, area.y, area.width, area.height)
    ctx.fillStyle = DEFAULT_BACKGROUND_COLOR
    ctx.fillRect(0, 0, area.width, area.height)
  }
}

export default RenderService
