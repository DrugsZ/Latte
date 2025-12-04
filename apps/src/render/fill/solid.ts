import type { FillType } from 'Latte/constants/schema'
import type { IEditorFillRenderContributionDescription } from 'Latte/render/renderContributionRegistry'

export class SolidColorFillRender
  implements IEditorFillRenderContributionDescription
{
  id: FillType.SOLID
  // eslint-disable-next-line class-methods-use-this
  render(fill: SolidColorPaint, ctx: CanvasRenderingContext2D) {
    const { color } = fill
    ctx.fillStyle = `rgb(${255 * color.r}, ${255 * color.g}, ${255 * color.b})`
    ctx.fill()
  }
}
