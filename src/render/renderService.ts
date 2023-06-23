import {
  getEditorShapeRender,
  registerEditorShapeRender,
  registerEditorFillRender,
  getEditorFillRender,
} from 'Latte/render/RenderContributionRegistry'
import { EditorElementTypeKind, FillType } from 'Latte/core/DisplayObject'
import { RectShapeRender } from 'Latte/render/shape/Rect'
import { EllipseShapeRender } from 'Latte/render/shape/Ellipse'
import Rect from 'Latte/elements/Rect'
import Ellipse from 'Latte/elements/Ellipse'
import { SolidColorFillRender } from 'Latte/render/fill/solid'
import { DEFAULT_BACKGROUND_COLOR } from 'Latte/constants'

registerEditorShapeRender(EditorElementTypeKind.ELLIPSE, EllipseShapeRender)
registerEditorShapeRender(EditorElementTypeKind.RECTANGLE, RectShapeRender)
registerEditorFillRender(FillType.SOLID, SolidColorFillRender)
class RenderService {
  private _ctx: CanvasRenderingContext2D
  constructor(private readonly _canvas: HTMLCanvasElement) {
    this._ctx = this._canvas.getContext('2d') as CanvasRenderingContext2D
  }

  public draw(
    renderObjects: (Rect | Ellipse)[],
    renderBox: Rectangle,
    zoom: number
  ): void {
    this._clearDrawArea()
    const ctx = this._ctx
    ctx.scale(zoom, zoom)
    ctx.translate(-renderBox.x, -renderBox.y)
    renderObjects.forEach(item => {
      ctx.save()
      const fills = item.getFills()
      fills.forEach(i => {
        // if (i.type === 'SOLID') {
        // const { color } = i
        // colorStr = `rgb(${255 * color.r}, ${255 * color.g}, ${255 * color.b})`
        const fillRender = getEditorFillRender(i.type)
        fillRender(i, ctx)
        // }
      })
      ctx.beginPath()
      const shapeRender = getEditorShapeRender(item.type)
      shapeRender?.(item, ctx)
      ctx.fill()
      ctx.restore()
    })
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
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(area.x, area.y, area.width, area.height)
    ctx.fillStyle = DEFAULT_BACKGROUND_COLOR
    ctx.fillRect(0, 0, area.width, area.height)
  }
}

export default RenderService
