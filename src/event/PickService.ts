import { Point } from 'Latte/math/Point'
import { IEventTarget } from 'Latte/core/interfaces'
import type DisplayObject from 'Latte/core/Container'
import { isRect, isEllipse } from 'Latte/utils/assert'
import type Ellipse from 'Latte/elements/Ellipse'
import type Rect from 'Latte/elements/Rect'

let isDownMode = false

export const setDown = mode => (isDownMode = mode)
export interface IPickerService {
  pick(point: Point): IEventTarget | null
}

export class PickService implements IPickerService {
  constructor(private readonly _visibleElementRenderObjects: DisplayObject[]) {
    this.pick = this.pick.bind(this)
  }

  private _isPointInEllipse = (point: Point, item: Ellipse) => {
    return false
  }

  private _isPointInRect = (point: Point, item: Rect) => {
    const { x, y, width, height } = item
    return (
      point.x > x && point.x < width + x && point.y > y && point.y < height + y
    )
  }

  pick(point: Point): IEventTarget | null {
    let target: any = null
    if (isDownMode) {
      console.log(point)
    }
    this._visibleElementRenderObjects.forEach(item => {
      if (isRect(item) && this._isPointInRect(point, item)) {
        target = item
      }
      if (isEllipse(item) && this._isPointInEllipse(point, item)) {
        target = item
      }
    })
    setDown(false)
    return target
  }
}
