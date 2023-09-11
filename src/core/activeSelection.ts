import type { DisplayObject } from 'Latte/core/displayObject'
import Rect from 'Latte/elements/rect'
import { EditorElementTypeKind } from 'Latte/constants/schema'
import { inBox, inLine } from 'Latte/math/inPointerInPath'
import { Matrix } from 'Latte/math/matrix'
import {
  DEFAULT_ACTIVE_SELECTION_LINT_WIDTH,
  DEFAULT_ACTIVE_SELECTION_CORNER_WIDTH,
  DEFAULT_ACTIVE_SELECTION_CORNER_HEIGHT,
} from 'Latte/constants/editor'
import { Rectangle } from 'Latte/core/rectangle'

const tempMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  tx: 0,
  ty: 0,
}

export enum MouseControllerTarget {
  NONE, // activeSelection is inactive
  BLANK, // activeSelection is active but not on area
  SELECTION_CONTEXT,
  SELECT_ROTATE_LEFT_TOP,
  SELECT_ROTATE_RIGHT_TOP,
  SELECT_ROTATE_LEFT_BOTTOM,
  SELECT_ROTATE_RIGHT_BOTTOM,
  SELECT_RESIZE_LEFT,
  SELECT_RESIZE_TOP,
  SELECT_RESIZE_RIGHT,
  SELECT_RESIZE_BOTTOM,
  SELECT_RESIZE_LEFT_TOP,
  SELECT_RESIZE_RIGHT_TOP,
  SELECT_RESIZE_LEFT_BOTTOM,
  SELECT_RESIZE_RIGHT_BOTTOM,
}

interface IActiveSelectionControl {
  controllerType: MouseControllerTarget
}

class ActiveSelectionCornerRectangle
  extends Rectangle
  implements IActiveSelectionControl
{
  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    public readonly controllerType: MouseControllerTarget
  ) {
    super(x, y, width, height)
  }
}

export class ActiveSelection extends Rect implements IActiveSelectionControl {
  private _objects: DisplayObject[] = []
  private _OBBDirty: boolean = false
  public readonly controllerType: MouseControllerTarget

  constructor() {
    super({
      type: EditorElementTypeKind.RECTANGLE,
      size: {
        x: 0,
        y: 0,
      },
      fillPaints: [{ type: 'SOLID' }],
      transform: {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        tx: 0,
        ty: 0,
      },
    })
    this.controllerType = MouseControllerTarget.SELECTION_CONTEXT
  }

  public addSelectElement(element: DisplayObject) {
    if (!element) return
    this._objects.push(element)
    this._OBBDirty = true
  }

  public removeSelectElement(element: DisplayObject) {
    if (!element) return
    this._objects = this._objects.filter(o => o !== element)
    this._OBBDirty = true
  }

  public clear() {
    this._objects = []
    this._OBBDirty = false
    this._bounds.clear()
  }

  public updateOBB() {
    const { _objects: objects } = this
    this._bounds.clear()
    objects.forEach(element => {
      if (!element.visible) {
        return
      }
      const elementBBox = element.getBounds()
      this._bounds.merge(elementBBox)
    })
    const rect = this._bounds.getRectangle()
    tempMatrix.tx = rect.x
    tempMatrix.ty = rect.y
    this._elementData.transform = { ...tempMatrix }
    this._elementData.size = {
      x: rect.width,
      y: rect.height,
    }
    this._OBBDirty = false
  }

  get OBB() {
    if (this._objects.length === 1) {
      return this._objects[0].OBB
    }
    if (this._OBBDirty) {
      this.updateOBB()
    }
    return super.OBB
  }

  public hasActive() {
    return !!this._objects.length
  }

  public hasSelected = (element: DisplayObject) =>
    this._objects.includes(element)

  public getCornerRect() {
    const { width, height } = this.OBB
    const halfWidth = DEFAULT_ACTIVE_SELECTION_CORNER_WIDTH / 2
    const halfHeight = DEFAULT_ACTIVE_SELECTION_CORNER_HEIGHT / 2
    const leftTopCorner = new ActiveSelectionCornerRectangle(
      -halfWidth,
      -halfHeight,
      DEFAULT_ACTIVE_SELECTION_CORNER_WIDTH,
      DEFAULT_ACTIVE_SELECTION_CORNER_HEIGHT,
      MouseControllerTarget.SELECT_RESIZE_LEFT_TOP
    )
    const rightTopCorner = new ActiveSelectionCornerRectangle(
      width - halfWidth,
      -halfHeight,
      DEFAULT_ACTIVE_SELECTION_CORNER_WIDTH,
      DEFAULT_ACTIVE_SELECTION_CORNER_HEIGHT,
      MouseControllerTarget.SELECT_RESIZE_RIGHT_TOP
    )
    const rightBottomCorner = new ActiveSelectionCornerRectangle(
      width - halfWidth,
      height - halfHeight,
      DEFAULT_ACTIVE_SELECTION_CORNER_WIDTH,
      DEFAULT_ACTIVE_SELECTION_CORNER_HEIGHT,
      MouseControllerTarget.SELECT_RESIZE_RIGHT_BOTTOM
    )
    const leftButtonCorner = new ActiveSelectionCornerRectangle(
      -halfWidth,
      height - halfHeight,
      DEFAULT_ACTIVE_SELECTION_CORNER_WIDTH,
      DEFAULT_ACTIVE_SELECTION_CORNER_HEIGHT,
      MouseControllerTarget.SELECT_RESIZE_LEFT_BOTTOM
    )
    return [leftTopCorner, rightTopCorner, rightBottomCorner, leftButtonCorner]
  }

  private _hitContext(point: IPoint) {
    const { width, height } = this.OBB
    if (inBox(0, 0, width, height, point.x, point.y)) {
      return MouseControllerTarget.SELECTION_CONTEXT
    }
    return MouseControllerTarget.NONE
  }

  private _hitBorder(point: IPoint) {
    const { width, height } = this.OBB
    if (
      inLine(
        0,
        0,
        width,
        0,
        DEFAULT_ACTIVE_SELECTION_LINT_WIDTH,
        point.x,
        point.y
      )
    ) {
      return MouseControllerTarget.SELECT_RESIZE_TOP
    }
    if (
      inLine(
        0,
        0,
        0,
        height,
        DEFAULT_ACTIVE_SELECTION_LINT_WIDTH,
        point.x,
        point.y
      )
    ) {
      return MouseControllerTarget.SELECT_RESIZE_LEFT
    }
    if (
      inLine(
        0,
        height,
        width,
        height,
        DEFAULT_ACTIVE_SELECTION_LINT_WIDTH,
        point.x,
        point.y
      )
    ) {
      return MouseControllerTarget.SELECT_RESIZE_BOTTOM
    }
    if (
      inLine(
        width,
        0,
        width,
        height,
        DEFAULT_ACTIVE_SELECTION_LINT_WIDTH,
        point.x,
        point.y
      )
    ) {
      return MouseControllerTarget.SELECT_RESIZE_RIGHT
    }
    return null
  }

  private _hitCorner(point: IPoint) {
    const corners = this.getCornerRect()
    let result: MouseControllerTarget | null = null
    corners.some(item => {
      const { x, y, width, height, controllerType } = item
      if (inBox(x, y, width, height, point.x, point.y)) {
        result = controllerType
        return !!result
      }
      return false
    })
    return result
  }

  public hitTest(point: IPoint) {
    const { transform } = this.OBB
    const localPosition = Matrix.applyMatrixInvertToPoint(transform, point)
    let target: MouseControllerTarget | null = null
    target = target || (!this.hasActive() ? MouseControllerTarget.NONE : null)
    target = target || this._hitCorner(localPosition)
    target = target || this._hitBorder(localPosition)
    target = target || this._hitContext(localPosition)

    return target || MouseControllerTarget.BLANK
  }

  public getObjects() {
    return this._objects
  }
}
