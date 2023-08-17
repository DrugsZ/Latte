import { DisplayObject } from 'Latte/core/displayObject'
import { ViewPart } from 'Latte/view/viewPart'
import type * as viewEvents from 'Latte/view/viewEvents'
import Page from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import type { FederatedPointerEvent } from 'Latte/core/federatedPointerEvent'
import { Matrix } from 'Latte/math/matrix'
import type { Camera } from 'Latte/core/cameraService'

export class SelectBox extends ViewPart {
  private _tempMatrix = new Matrix()

  constructor(context) {
    super(context)
    this.onCanvasMouseDown = this.onCanvasMouseDown.bind(this)
  }

  public onCanvasMouseDown(e: FederatedPointerEvent) {
    const { target } = e
    const activeSelection = this._context.getActiveSelection()
    if (target instanceof EditorDocument || target instanceof Page) {
      this._context.clearSelection()
      return
    }
    if (target instanceof DisplayObject) {
      if (activeSelection.hasSelected(target)) {
        this._context.removeSelectElement(target)
      } else {
        this._context.addSelectElement(target)
      }
    }
  }

  public override onCameraChange(): boolean {
    return true
  }

  public override onElementChange(
    event: viewEvents.ViewElementChangeEvent
  ): boolean {
    return true
  }

  public override onActiveSelectionChange(
    event: viewEvents.ViewActiveSelectionChangeEvent
  ): boolean {
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
    ctx.strokeStyle = 'yellow'
    const { a, b, c, d, tx, ty } = this._tempMatrix
    ctx.setTransform(a, b, c, d, tx, ty)
    ctx.strokeRect(0, 0, rect.width, rect.height)
  }
}
