import { ViewPart } from 'Latte/core/viewParts/base/viewPart'
import { Matrix } from 'Latte/core/utils/matrix'
import type { Camera } from 'Latte/core/services/camera/cameraService'
import type { ActiveSelection } from 'Latte/core/selection/activeSelection'

export class SelectBox extends ViewPart {
  private _tempMatrix = new Matrix()

  public override onCameraChange(): boolean {
    return true
  }

  public override onElementChange(): boolean {
    return true
  }

  public override onActiveSelectionChange(): boolean {
    return true
  }

  private _renderBorder(ctx: CanvasRenderingContext2D, rect: Rectangle) {
    ctx.strokeStyle = '#0B94BF'
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
  }

  private _renderControl(
    ctx: CanvasRenderingContext2D,
    activeSelection: ActiveSelection
  ) {
    const corners = activeSelection.getCorners()
    corners.forEach(item => {
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.fillRect(item.x, item.y, item.width, item.height)
      ctx.closePath()
      this._renderBorder(ctx, item)
    })
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera) {
    const activeSelection = this._context.getActiveSelection()
    if (!activeSelection.hasActive()) {
      return
    }
    const rect = activeSelection.OBB
    Matrix.multiply(
      this._tempMatrix,
      camera.getViewPortMatrix(),
      rect.transform
    )
    const { a, b, c, d, tx, ty } = this._tempMatrix
    ctx.setTransform(a, b, c, d, tx, ty)
    ctx.lineWidth = 2 * camera.getZoom()
    ctx.beginPath()
    ctx.strokeStyle = '#0B94BF'
    ctx.strokeRect(0, 0, rect.width, rect.height)
    ctx.closePath()
    this._renderControl(ctx, activeSelection)
  }
}
