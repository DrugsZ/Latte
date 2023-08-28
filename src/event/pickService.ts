/* eslint-disable class-methods-use-this */
import { EventTarget } from 'Latte/core/eventTarget'
import type DisplayObject from 'Latte/core/container'
import { isRect, isEllipse } from 'Latte/utils/assert'
import type Ellipse from 'Latte/elements/ellipse'
import type Rect from 'Latte/elements/rect'
import {
  inBox,
  inRectWithRadius,
  ellipseDistance,
} from 'Latte/math/inPointerInPath'
import { Matrix } from 'Latte/math/matrix'
import { ActiveSelection } from 'Latte/core/activeSelection'

export interface IPickerService {
  pick(point: IPoint): EventTarget | null
}

export class PickService implements IPickerService {
  constructor(
    private readonly _getVisibleElementRenderObjects: () => DisplayObject[],
    private readonly _activeSelection: ActiveSelection
  ) {
    this.pick = this.pick.bind(this)
  }

  private _isPointInEllipse = (point: IPoint, item: Ellipse) => {
    const { width, height } = item.OBB
    const { x, y } = point
    const radiusX = width / 2
    const radiusY = height / 2
    const squareX = (x - radiusX) * (x - radiusX)
    const squareY = (y - radiusY) * (y - radiusY)

    return ellipseDistance(squareX, squareY, radiusX, radiusY) <= 1
  }

  private _isPointInRect = (point: IPoint, item: Rect) => {
    const { width, height } = item.OBB
    const fills = item.getFills()
    if (!fills) return false
    const border = item.getBorder()
    const currentBorders: [number, number, number, number] = Array.isArray(
      border
    )
      ? border
      : [border, border, border, border]
    const hasBorder = currentBorders.some(b => !!b)
    if (!hasBorder) {
      return inBox(0, 0, width, height, point.x, point.y)
    }
    return inRectWithRadius(
      0,
      0,
      width,
      height,
      currentBorders,
      0,
      point.x,
      point.y
    )
  }

  pick(point: IPoint): EventTarget | null {
    let target: any = null
    const findElements =
      this._getVisibleElementRenderObjects().slice().reverse() || []
    findElements.some(item => {
      const localPosition = Matrix.applyMatrixInvertToPoint(
        item.transform,
        point
      )
      if (isRect(item) && this._isPointInRect(localPosition, item)) {
        target = item
        return true
      }
      if (isEllipse(item) && this._isPointInEllipse(localPosition, item)) {
        target = item
        return true
      }
      return false
    })
    return target
  }

  pickActiveSelection(point: IPoint) {
    return this._activeSelection.hitTest(point)
  }
}
