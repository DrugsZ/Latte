/* eslint-disable class-methods-use-this */
import Rect from 'Latte/elements/Rect'
import { EditorElementTypeKind } from 'Latte/core/DisplayObject'
import { IEditorShapeRenderContributionDescription } from 'Latte/render/RenderContributionRegistry'

export class RectShapeRender
  implements
    IEditorShapeRenderContributionDescription<EditorElementTypeKind.RECTANGLE>
{
  readonly id = EditorElementTypeKind.RECTANGLE
  private static hasBorder(renderObject: Rect) {
    return renderObject.getBorder() !== null
  }

  public render = (renderObject: Rect, ctx: CanvasRenderingContext2D) => {
    const { x, y, width, height } = renderObject
    const transform = renderObject.getWorldTransform()
    const { a, b, c, d } = transform
    const centerX = x + width / 2
    const centerY = y + height / 2
    ctx.translate(centerX, centerY)
    ctx.transform(a, b, c, d, 0, 0)
    ctx.translate(-centerX, -centerY)
    if (RectShapeRender.hasBorder(renderObject)) {
      const borders = renderObject.getBorder()
      ctx.roundRect(x, y, width, height, borders)
      return
    }
    ctx.rect(x, y, width, height)
  }
}
