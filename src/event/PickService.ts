/* eslint-disable class-methods-use-this */
import type { Point } from 'Latte/common/Point'
import type { IEventTarget } from 'Latte/core/interfaces'
import type DisplayObject from 'Latte/core/Container'
import { isRect, isEllipse } from 'Latte/utils/assert'
import type Ellipse from 'Latte/elements/Ellipse'
import type Rect from 'Latte/elements/Rect'
import { inBox } from 'Latte/math/inPointerInPath'

// let isDownMode = false

// export const setDown = mode => (isDownMode = mode)
export interface IPickerService {
  pick(point: Point): IEventTarget | null
}

export class PickService implements IPickerService {
  constructor(private readonly _visibleElementRenderObjects: DisplayObject[]) {
    this.pick = this.pick.bind(this)
  }

  private _isPointInEllipse = (point: Point, item: Ellipse) => false

  private _isPointInRect = (point: Point, item: Rect) => {
    const { x, y, width, height } = item
    const fills = item.getFills()
    if (!fills) return false
    const border = item.getBorder()
    const currentBorders = Array.isArray(border) ? border : [border]
    const hasBorder = currentBorders.some(item => item !== 0)
    if (!hasBorder) {
      return inBox(x, y, width, height, point.x, point.y)
    }
  }

  pick(point: Point): IEventTarget | null {
    let target: any = null
    const findElements = this._visibleElementRenderObjects.slice().reverse()
    findElements.some(item => {
      if (isRect(item) && this._isPointInRect(point, item)) {
        target = item
        return true
      }
      if (isEllipse(item) && this._isPointInEllipse(point, item)) {
        target = item
        return true
      }
    })
    return target
  }
}
