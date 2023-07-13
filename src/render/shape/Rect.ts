/* eslint-disable class-methods-use-this */
import type Rect from 'Latte/elements/Rect'
import { EditorElementTypeKind } from 'Latte/constants/schema'
import type { IEditorShapeRenderContributionDescription } from 'Latte/render/RenderContributionRegistry'
import { Matrix, getTranslation } from 'Latte/math/matrix'

export class RectShapeRender
  implements
    IEditorShapeRenderContributionDescription<EditorElementTypeKind.RECTANGLE>
{
  readonly id = EditorElementTypeKind.RECTANGLE
  private _tempMatrix = new Matrix()

  private static hasBorder(renderObject: Rect) {
    return renderObject.getBorder() !== null
  }

  public render = (
    renderObject: Rect,
    ctx: CanvasRenderingContext2D,
    contextMatrix: Matrix
  ) => {
    const { width, height } = renderObject
    const transform = renderObject.getWorldTransform()
    const centerX = -(width / 2)
    const centerY = -(height / 2)
    const [tx1, ty1] = getTranslation([0, 0], transform, [centerX, centerY])
    Matrix.multiply(this._tempMatrix, contextMatrix, transform)
    const { a, b, c, d, tx, ty } = this._tempMatrix
    ctx.setTransform(a, b, c, d, tx, ty)
    if (RectShapeRender.hasBorder(renderObject)) {
      const borders = renderObject.getBorder()
      ctx.roundRect(0, 0, width, height, borders)
      return
    }
    ctx.rect(0, 0, width, height)
  }
}
