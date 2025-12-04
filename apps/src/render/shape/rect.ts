/* eslint-disable class-methods-use-this */
import type Rect from 'Latte/core/elements/rect'
import { EditorElementTypeKind } from 'Latte/constants/schema'
import type { IEditorShapeRenderContributionDescription } from 'Latte/render/renderContributionRegistry'

export class RectShapeRender
  implements
    IEditorShapeRenderContributionDescription<EditorElementTypeKind.RECTANGLE>
{
  readonly id = EditorElementTypeKind.RECTANGLE

  private static hasBorder(renderObject: Rect) {
    return renderObject.getBorder() !== null
  }

  public render = (renderObject: Rect, ctx: CanvasRenderingContext2D) => {
    const { width, height } = renderObject
    if (RectShapeRender.hasBorder(renderObject)) {
      const borders = renderObject.getBorder()
      ctx.roundRect(0, 0, width, height, borders)
      return
    }
    ctx.rect(0, 0, width, height)
  }
}
