import { ViewPart } from 'Latte/view/viewPart'
import type { ViewModel } from 'Latte/core/viewModel'
import type { Camera } from 'Latte/core/cameraService'
import 'Latte/view/viewCursor.css'
import type * as viewEvents from 'Latte/view/viewEvents'
import { CURSORS } from 'Latte/constants/cursor'
import { OperateMode } from 'Latte/core/cursor'
import { Matrix } from 'Latte/math/matrix'

export class ViewCursor extends ViewPart {
  private _tempMatrix = new Matrix()

  constructor(
    viewModel: ViewModel,
    private readonly _renderDOM: HTMLCanvasElement
  ) {
    super(viewModel)
    this._renderDOM.className = 'latte-cursor'
  }

  public override onOperateModeChange(
    event: viewEvents.ViewCursorOperateModeChange
  ) {
    const { mode } = event
    if (mode === OperateMode.Edit) {
      this._renderDOM.style.setProperty(
        '--main-cursor',
        CURSORS.default(0, 0, 0)
      )
    }
    if (mode === OperateMode.ReadOnly) {
      this._renderDOM.style.setProperty('--main-cursor', CURSORS.add(0, 0, 0))
    }
    return false
  }

  public override onHoverObjectChange(
    event: viewEvents.ViewHoverObjectChangeEvent
  ): boolean {
    return true
  }

  public override onHoverControllerKeyChange(
    event: viewEvents.ViewHoverControllerKeyChangeEvent
  ): boolean {
    return false
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const target = this._context.getCursorHoverObject()
    if (!target) {
      return
    }
    const { OBB } = target
    Matrix.multiply(this._tempMatrix, camera.getViewPortMatrix(), OBB.transform)
    const { a, b, c, d, tx, ty } = this._tempMatrix
    ctx.setTransform(a, b, c, d, tx, ty)
    ctx.beginPath()
    ctx.strokeStyle = '#0B94BF'
    ctx.strokeRect(0, 0, OBB.width, OBB.height)
    ctx.closePath()
  }
}
