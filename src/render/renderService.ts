import {
  getEditorShapeRender,
  registerEditorShapeRender,
  registerEditorFillRender,
  getEditorFillRender,
} from 'Latte/render/RenderContributionRegistry'
import { EditorElementTypeKind, FillType } from 'Latte/constants/schema'
import { RectShapeRender } from 'Latte/render/shape/Rect'
import { EllipseShapeRender } from 'Latte/render/shape/Ellipse'
import type Rect from 'Latte/elements/Rect'
import type Ellipse from 'Latte/elements/Ellipse'
import { SolidColorFillRender } from 'Latte/render/fill/solid'
import { DEFAULT_BACKGROUND_COLOR } from 'Latte/constants'
import type { Camera } from 'Latte/core/CameraService'
import { Matrix } from 'Latte/math/matrix'

registerEditorShapeRender(EditorElementTypeKind.ELLIPSE, EllipseShapeRender)
registerEditorShapeRender(EditorElementTypeKind.RECTANGLE, RectShapeRender)
registerEditorFillRender(FillType.SOLID, SolidColorFillRender)
class RenderService {
  private _ctx: CanvasRenderingContext2D
  constructor(private readonly _canvas: HTMLCanvasElement) {
    this._ctx = this._canvas.getContext('2d') as CanvasRenderingContext2D
  }

  public draw(renderObjects: (Rect | Ellipse)[], camera: Camera): void {
    this._clearDrawArea()
    const ctx = this._ctx
    const vpMatrix = camera.getViewPortMatrix()
    ctx.setTransform(
      vpMatrix[0],
      vpMatrix[1],
      vpMatrix[2],
      vpMatrix[3],
      vpMatrix[4],
      vpMatrix[5]
    )
    // ctx.fillStyle = 'red'
    // ctx.beginPath()
    // ctx.rect(-200, -200, 100, 100)
    // ctx.closePath()
    // ctx.fill()
    const contextMatrix = new Matrix(
      vpMatrix[0],
      vpMatrix[1],
      vpMatrix[2],
      vpMatrix[3],
      vpMatrix[4],
      vpMatrix[5]
    )
    // const contextMatrix = new Matrix(1, 0, 0, 1, vpMatrix[4], vpMatrix[5])
    renderObjects.forEach(item => {
      ctx.save()
      const fills = item.getFills()
      fills.forEach(i => {
        const fillRender = getEditorFillRender(i.type)
        fillRender(i, ctx)
      })
      ctx.beginPath()
      const shapeRender = getEditorShapeRender(item.type)
      shapeRender?.(item, ctx, contextMatrix)
      ctx.fill()
      ctx.closePath()
      ctx.restore()
    })
    // ctx.restore()
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
