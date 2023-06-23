/* eslint-disable class-methods-use-this */
import type { EditorShapeRender } from 'Cditor/render/RenderContributionRegistry'
import Ellipse from 'Cditor/elements/Ellipse'

export class EllipseShapeRender implements EditorShapeRender {
  public render = (renderObject: Ellipse, ctx: CanvasRenderingContext2D) => {
    const { x, y, width, height } = renderObject
    const radiusX = width / 2
    const radiusY = height / 2
    const transform = renderObject.getWorldTransform()
    const { a, b, c, d } = transform
    const centerX = x + radiusX
    const centerY = y + radiusY
    ctx.translate(centerX, centerY)
    ctx.transform(a, b, c, d, 0, 0)
    ctx.translate(-centerX, -centerY)
    ctx.ellipse(x, y, radiusX, radiusY, 0, 0, 2 * Math.PI)
  }
}
