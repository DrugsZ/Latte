/* eslint-disable no-bitwise */
import { ViewPart } from 'Latte/view/viewPart'
import type { ViewModel } from 'Latte/core/viewModel'
import type { Camera } from 'Latte/core/cameraService'
import 'Latte/view/viewCursor.css'
import type * as viewEvents from 'Latte/view/viewEvents'
import { CURSORS } from 'Latte/constants/cursor'
import { OperateMode } from 'Latte/core/cursor'
import { Matrix } from 'Latte/math/matrix'
import type {
  ROTATE_KEY_TYPE,
  RESIZE_KEY_TYPE,
} from 'Latte/core/activeSelection'
import {
  MouseControllerTarget,
  isResizeKey,
  isRotateKey,
} from 'Latte/core/activeSelection'

export const getDegFromTransform = (transform: Matrix) => {
  const { a: matrixA, b: matrixB } = transform
  const degree = Math.atan2(matrixB, matrixA) * (180 / Math.PI)
  return degree
}

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

  private _setRotateCursor(key: ROTATE_KEY_TYPE) {
    let deg = 0
    switch (key) {
      case MouseControllerTarget.SELECT_ROTATE_LEFT_BOTTOM:
        deg = 90
        break
      case MouseControllerTarget.SELECT_ROTATE_LEFT_TOP:
        deg = 180
        break
      case MouseControllerTarget.SELECT_ROTATE_RIGHT_TOP:
        deg = 270
        break
      default:
        deg = 0
        break
    }
    this._renderDOM.style.setProperty(
      '--main-cursor',
      CURSORS.rotate(deg, 0, 0)
    )
  }

  private _setResizeCursor(key: RESIZE_KEY_TYPE) {
    let deg = 0
    switch (key) {
      case MouseControllerTarget.SELECT_RESIZE_RIGHT_BOTTOM:
        deg = 45
        break
      case MouseControllerTarget.SELECT_RESIZE_BOTTOM:
        deg = 90
        break
      case MouseControllerTarget.SELECT_RESIZE_LEFT_BOTTOM:
        deg = 135
        break
      case MouseControllerTarget.SELECT_RESIZE_LEFT:
        deg = 180
        break
      case MouseControllerTarget.SELECT_RESIZE_LEFT_TOP:
        deg = 225
        break
      case MouseControllerTarget.SELECT_RESIZE_TOP:
        deg = 270
        break
      case MouseControllerTarget.SELECT_RESIZE_RIGHT_TOP:
        deg = 315
        break
      default:
        deg = 0
        break
    }
    this._renderDOM.style.setProperty(
      '--main-cursor',
      CURSORS.resize(deg, 0, 0)
    )
  }

  public override onHoverControllerKeyChange(
    event: viewEvents.ViewHoverControllerKeyChangeEvent
  ): boolean {
    const { controllerKey } = event
    if (isRotateKey(controllerKey)) {
      this._setRotateCursor(controllerKey)
    } else if (isResizeKey(controllerKey)) {
      this._setResizeCursor(controllerKey)
    } else {
      this._renderDOM.style.setProperty(
        '--main-cursor',
        CURSORS.default(0, 0, 0)
      )
    }
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
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.strokeStyle = '#0B94BF'
    ctx.strokeRect(0, 0, OBB.width, OBB.height)
    ctx.closePath()
  }
}
