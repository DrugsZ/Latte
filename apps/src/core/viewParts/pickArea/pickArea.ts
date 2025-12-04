import { ViewPart } from 'Latte/core/viewParts/base/viewPart'
import type { Camera } from 'Latte/core/services/camera/cameraService'
import type { ViewCursorMoveEvent } from 'Latte/core/viewParts/base/viewEvents'

export class PickArea extends ViewPart {
  public override onCursorMove(event: ViewCursorMoveEvent): boolean {
    return true
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera) {
    const selectBoxBounds = this._context.getBoxSelectBounds()
    if (selectBoxBounds.isEmpty()) {
      return
    }
    const { x, y, width, height } = selectBoxBounds.getRectangle()
    const { a, b, c, d, tx, ty } = camera.getViewPortMatrix()
    ctx.setTransform(a, b, c, d, tx, ty)
    ctx.fillStyle = '#00CCFF'
    ctx.globalAlpha = 0.3
    ctx.fillRect(x, y, width, height)
  }
}
