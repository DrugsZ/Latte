/* eslint-disable class-methods-use-this */
import type { EventTarget } from 'Latte/core/eventTarget'
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
import type { ActiveSelection } from 'Latte/core/activeSelection'
import type { EditorDocument } from 'Latte/elements/document'

export interface IPickerService {
  pick(vec: ReadonlyVec2): EventTarget | null
}

export class PickService implements IPickerService {
  constructor(
    private readonly _getVisibleElementRenderObjects: () => DisplayObject[],
    private readonly _activeSelection: ActiveSelection,
    private readonly _root: EditorDocument
  ) {
    this.pick = this.pick.bind(this)
  }

  private _isPointInEllipse = (vec: ReadonlyVec2, item: Ellipse) => {
    const { width, height } = item.OBB
    const [x, y] = vec
    const radiusX = width / 2
    const radiusY = height / 2
    const squareX = (x - radiusX) * (x - radiusX)
    const squareY = (y - radiusY) * (y - radiusY)

    return ellipseDistance(squareX, squareY, radiusX, radiusY) <= 1
  }

  private _isPointInRect = (vec: ReadonlyVec2, item: Rect) => {
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
      return inBox(0, 0, width, height, vec[0], vec[1])
    }
    return inRectWithRadius(
      0,
      0,
      width,
      height,
      currentBorders,
      0,
      vec[0],
      vec[1]
    )
  }

  pick(vec: ReadonlyVec2) {
    let target: DisplayObject = this._root
    const findElements =
      this._getVisibleElementRenderObjects().slice().reverse() || []
    findElements.some(item => {
      const localPosition = Matrix.applyMatrixInvertToPoint(item.transform, vec)
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

  pickActiveSelection(vec: ReadonlyVec2) {
    return this._activeSelection.hitTest(vec)
  }

  disabled() {}
}
