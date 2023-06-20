/* eslint-disable class-methods-use-this */
import type { EditorShapeRender } from 'Cditor/core/RenderContributionRegistry'
import type { IRectRenderObject } from 'Cditor/elements/Rect'

export class RectShapeRender implements EditorShapeRender {
  public render = (
    renderObject: IRectRenderObject,
    ctx: CanvasRenderingContext2D
  ) => {
    const { x, y, width, height, transform } = renderObject
    const { a, b, c, d } = transform
    const centerX = x + width / 2
    const centerY = y + height / 2
    ctx.translate(centerX, centerY)
    ctx.transform(a, b, c, d, 0, 0)
    ctx.translate(-centerX, -centerY)
    ctx.rect(x, y, width, height)
  }
}
