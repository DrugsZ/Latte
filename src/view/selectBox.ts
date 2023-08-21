import { ViewPart } from 'Latte/view/viewPart'
import { Matrix } from 'Latte/math/matrix'
import type { Camera } from 'Latte/core/cameraService'

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

  render(ctx: CanvasRenderingContext2D, camera: Camera) {
    const activeSelection = this._context.getActiveSelection()
    if (!activeSelection.hasActive()) {
      return
    }
    const rect = activeSelection.getOBB()!
    Matrix.multiply(
      this._tempMatrix,
      camera.getViewPortMatrix(),
      rect.transform
    )
    ctx.strokeStyle = 'red'
    const { a, b, c, d, tx, ty } = this._tempMatrix
    ctx.setTransform(a, b, c, d, tx, ty)
    ctx.strokeRect(0, 0, rect.width, rect.height)
  }
}
