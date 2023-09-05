/* eslint-disable class-methods-use-this */
import type Rect from 'Latte/elements/rect'
import { EditorElementTypeKind } from 'Latte/constants/schema'
import type { IEditorShapeRenderContributionDescription } from 'Latte/render/renderContributionRegistry'
import { Matrix } from 'Latte/math/matrix'

export class RectShapeRender
  implements
    IEditorShapeRenderContributionDescription<EditorElementTypeKind.RECTANGLE>
{
  readonly id = EditorElementTypeKind.RECTANGLE
  private _tempMatrix: IMatrixLike = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    tx: 0,
    ty: 0,
  }

  private static hasBorder(renderObject: Rect) {
    return renderObject.getBorder() !== null
  }

  public render = (
    renderObject: Rect,
    ctx: CanvasRenderingContext2D,
    contextMatrix: Matrix
  ) => {
    const { width, height } = renderObject
    const { transform } = renderObject
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
