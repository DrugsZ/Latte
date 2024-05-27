/* eslint-disable class-methods-use-this */
import type { EditorElementTypeKind } from 'Latte/constants/schema'
import type { IEditorShapeRenderContributionDescription } from 'Latte/render/renderContributionRegistry'
import type Ellipse from 'Latte/elements/ellipse'

export class EllipseShapeRender
  implements
    IEditorShapeRenderContributionDescription<EditorElementTypeKind.ELLIPSE>
{
  readonly id: EditorElementTypeKind.ELLIPSE

  public render = (renderObject: Ellipse, ctx: CanvasRenderingContext2D) => {
    const { width, height } = renderObject
    const radiusX = width / 2
    const radiusY = height / 2
    ctx.ellipse(radiusX, radiusY, radiusX, radiusY, 0, 0, 2 * Math.PI)
  }
}
