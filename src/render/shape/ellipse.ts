/* eslint-disable class-methods-use-this */
import type { EditorElementTypeKind } from 'Latte/constants/schema'
import type { IEditorShapeRenderContributionDescription } from 'Latte/render/renderContributionRegistry'
import type Ellipse from 'Latte/elements/ellipse'
import { Matrix } from 'Latte/math/matrix'

export class EllipseShapeRender
  implements
    IEditorShapeRenderContributionDescription<EditorElementTypeKind.ELLIPSE>
{
  readonly id: EditorElementTypeKind.ELLIPSE
  private _tempMatrix = new Matrix()

  public render = (
    renderObject: Ellipse,
    ctx: CanvasRenderingContext2D,
    contextMatrix: Matrix
  ) => {
    const { width, height } = renderObject
    const radiusX = width / 2
    const radiusY = height / 2
    const transform = renderObject.getWorldTransform()
    Matrix.multiply(this._tempMatrix, contextMatrix, transform)
    const { a, b, c, d, tx, ty } = this._tempMatrix
    ctx.setTransform(a, b, c, d, tx, ty)
    ctx.ellipse(radiusX, radiusY, radiusX, radiusY, 0, 0, 2 * Math.PI)
  }
}
