/* eslint-disable class-methods-use-this */
import type { Point } from 'Latte/common/Point'
import type { IEventTarget } from 'Latte/core/interfaces'
import type DisplayObject from 'Latte/core/container'
import { isRect, isEllipse } from 'Latte/utils/assert'
import type Ellipse from 'Latte/elements/ellipse'
import type Rect from 'Latte/elements/rect'
import {
  inBox,
  inRectWithRadius,
  ellipseDistance,
} from 'Latte/math/inPointerInPath'

export interface IPickerService {
  pick(point: Point): IEventTarget | null
}

export class PickService implements IPickerService {
  constructor(
    private readonly _getVisibleElementRenderObjects: () => DisplayObject[]
  ) {
    this.pick = this.pick.bind(this)
  }

  private _isPointInEllipse = (point: Point, item: Ellipse) => {
    const { width, height } = item
    const { x, y } = point
    const radiusX = width / 2
    const radiusY = height / 2
    const squareX = (x - radiusX) * (x - radiusX)
    const squareY = (y - radiusY) * (y - radiusY)

    return ellipseDistance(squareX, squareY, radiusX, radiusY) <= 1
  }

  private _isPointInRect = (point: Point, item: Rect) => {
    const { width, height } = item
    const fills = item.getFills()
    if (!fills) return false
    const border = item.getBorder()
    const currentBorders: [number, number, number, number] = Array.isArray(
      border
    )
      ? border
      : [border, border, border, border]
    const hasBorder = currentBorders.some(b => b !== 0)
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

  pick(point: Point): IEventTarget | null {
    let target: any = null
    const findElements =
      this._getVisibleElementRenderObjects().slice().reverse() || []
    findElements.some(item => {
      const localPosition = item.getWorldTransform().applyInvertToPoint(point)
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
}
