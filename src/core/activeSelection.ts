/* eslint-disable no-bitwise */
import type { DisplayObject } from 'Latte/core/displayObject'
import Rect from 'Latte/elements/rect'
import { EditorElementTypeKind } from 'Latte/constants/schema'
import { inBox, inLine } from 'Latte/math/inPointerInPath'
import { Matrix } from 'Latte/math/matrix'
import { DEFAULT_ACTIVE_SELECTION_LINT_WIDTH } from 'Latte/constants/editor'

const tempMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  tx: 0,
  ty: 0,
}

export enum MouseControllerTarget {
  NONE = 1 << 0, // activeSelection is inactive
  BLANK = 1 << 1, // activeSelection is active but not on area
  SELECTION_CONTEXT = 1 << 2,
  SELECT_ROTATE_LEFT_TOP = 1 << 3,
  SELECT_ROTATE_RIGHT_TOP = 1 << 4,
  SELECT_ROTATE_LEFT_BOTTOM = 1 << 5,
  SELECT_ROTATE_RIGHT_BOTTOM = 1 << 6,
  SELECT_RESIZE_LEFT = 1 << 7,
  SELECT_RESIZE_TOP = 1 << 8,
  SELECT_RESIZE_RIGHT = 1 << 9,
  SELECT_RESIZE_BOTTOM = 1 << 10,
  SELECT_RESIZE_LEFT_TOP = 1 << 11,
  SELECT_RESIZE_RIGHT_TOP = 1 << 12,
  SELECT_RESIZE_RIGHT_BOTTOM = 1 << 13,
  SELECT_RESIZE_LEFT_BOTTOM = 1 << 14,
}

export const ROTATE_KEY =
  MouseControllerTarget.SELECT_ROTATE_LEFT_TOP |
  MouseControllerTarget.SELECT_ROTATE_RIGHT_TOP |
  MouseControllerTarget.SELECT_ROTATE_LEFT_BOTTOM |
  MouseControllerTarget.SELECT_ROTATE_RIGHT_BOTTOM

export type ROTATE_KEY_TYPE =
  | MouseControllerTarget.SELECT_ROTATE_LEFT_TOP
  | MouseControllerTarget.SELECT_ROTATE_RIGHT_TOP
  | MouseControllerTarget.SELECT_ROTATE_LEFT_BOTTOM
  | MouseControllerTarget.SELECT_ROTATE_RIGHT_BOTTOM

export const isRotateKey = (
  key: MouseControllerTarget
): key is ROTATE_KEY_TYPE => !!(ROTATE_KEY & key)

export const RESET_START_POSITION_X_AXIS_KEY =
  MouseControllerTarget.SELECT_RESIZE_LEFT |
  MouseControllerTarget.SELECT_RESIZE_LEFT_TOP |
  MouseControllerTarget.SELECT_RESIZE_LEFT_BOTTOM

export type RESET_START_POSITION_X_AXIS_KEY_TYPE =
  | MouseControllerTarget.SELECT_RESIZE_LEFT
  | MouseControllerTarget.SELECT_RESIZE_LEFT_TOP
  | MouseControllerTarget.SELECT_RESIZE_LEFT_BOTTOM

export const RESET_START_POSITION_Y_AXIS_KEY =
  MouseControllerTarget.SELECT_RESIZE_TOP |
  MouseControllerTarget.SELECT_RESIZE_LEFT_TOP |
  MouseControllerTarget.SELECT_RESIZE_RIGHT_TOP

export type RESET_START_POSITION_Y_AXIS_KEY_TYPE =
  | MouseControllerTarget.SELECT_RESIZE_TOP
  | MouseControllerTarget.SELECT_RESIZE_LEFT_TOP
  | MouseControllerTarget.SELECT_RESIZE_RIGHT_TOP

export const RESET_END_POSITION_X_AXIS_KEY =
  MouseControllerTarget.SELECT_RESIZE_RIGHT |
  MouseControllerTarget.SELECT_RESIZE_RIGHT_TOP |
  MouseControllerTarget.SELECT_RESIZE_RIGHT_BOTTOM

export type RESET_END_POSITION_X_AXIS_KEY_TYPE =
  | MouseControllerTarget.SELECT_RESIZE_RIGHT
  | MouseControllerTarget.SELECT_RESIZE_RIGHT_TOP
  | MouseControllerTarget.SELECT_RESIZE_RIGHT_BOTTOM

export const RESET_END_POSITION_Y_AXIS_KEY =
  MouseControllerTarget.SELECT_RESIZE_BOTTOM |
  MouseControllerTarget.SELECT_RESIZE_LEFT_BOTTOM |
  MouseControllerTarget.SELECT_RESIZE_RIGHT_BOTTOM

export type RESET_END_POSITION_Y_AXIS_KEY_TYPE =
  | MouseControllerTarget.SELECT_RESIZE_BOTTOM
  | MouseControllerTarget.SELECT_RESIZE_LEFT_BOTTOM
  | MouseControllerTarget.SELECT_RESIZE_RIGHT_BOTTOM

export const isResetStartXAxis = (
  key: MouseControllerTarget
): key is RESET_START_POSITION_X_AXIS_KEY_TYPE =>
  !!(RESET_START_POSITION_X_AXIS_KEY & key)
export const isResetStartYAxis = (
  key: MouseControllerTarget
): key is RESET_START_POSITION_Y_AXIS_KEY_TYPE =>
  !!(RESET_START_POSITION_Y_AXIS_KEY & key)
export const isResetEndXAxis = (
  key: MouseControllerTarget
): key is RESET_END_POSITION_X_AXIS_KEY_TYPE =>
  !!(RESET_END_POSITION_X_AXIS_KEY & key)
export const isResetEndYAxis = (
  key: MouseControllerTarget
): key is RESET_END_POSITION_Y_AXIS_KEY_TYPE =>
  !!(RESET_END_POSITION_Y_AXIS_KEY & key)

export const RESIZE_CORNER_KEY =
  MouseControllerTarget.SELECT_RESIZE_LEFT_TOP |
  MouseControllerTarget.SELECT_RESIZE_RIGHT_TOP |
  MouseControllerTarget.SELECT_RESIZE_RIGHT_BOTTOM |
  MouseControllerTarget.SELECT_RESIZE_LEFT_BOTTOM

export type RESIZE_CORNER_KEY_TYPE =
  | MouseControllerTarget.SELECT_RESIZE_LEFT_TOP
  | MouseControllerTarget.SELECT_RESIZE_RIGHT_TOP
  | MouseControllerTarget.SELECT_RESIZE_RIGHT_BOTTOM
  | MouseControllerTarget.SELECT_RESIZE_LEFT_BOTTOM

export const isResizeCornerKey = (
  key: MouseControllerTarget
): key is RESIZE_CORNER_KEY_TYPE => !!(RESIZE_CORNER_KEY & key)

export const RESIZE_KEY =
  MouseControllerTarget.SELECT_RESIZE_LEFT |
  MouseControllerTarget.SELECT_RESIZE_TOP |
  MouseControllerTarget.SELECT_RESIZE_RIGHT |
  MouseControllerTarget.SELECT_RESIZE_BOTTOM |
  MouseControllerTarget.SELECT_RESIZE_LEFT_TOP |
  MouseControllerTarget.SELECT_RESIZE_RIGHT_TOP |
  MouseControllerTarget.SELECT_RESIZE_RIGHT_BOTTOM |
  MouseControllerTarget.SELECT_RESIZE_LEFT_BOTTOM

export type RESIZE_KEY_TYPE =
  | MouseControllerTarget.SELECT_RESIZE_LEFT
  | MouseControllerTarget.SELECT_RESIZE_TOP
  | MouseControllerTarget.SELECT_RESIZE_RIGHT
  | MouseControllerTarget.SELECT_RESIZE_BOTTOM
  | MouseControllerTarget.SELECT_RESIZE_LEFT_TOP
  | MouseControllerTarget.SELECT_RESIZE_RIGHT_TOP
  | MouseControllerTarget.SELECT_RESIZE_RIGHT_BOTTOM
  | MouseControllerTarget.SELECT_RESIZE_LEFT_BOTTOM

export const isResizeKey = (
  key: MouseControllerTarget
): key is RESIZE_KEY_TYPE => !!(RESIZE_KEY & key)

class ActiveSelectionCorner {
  private static _RESIZE_WIDTH = 6
  private static _RESIZE_HEIGHT = 6
  private static _ROTATE_WIDTH = 30
  private static _ROTATE_HEIGHT = 30

  constructor(
    private readonly _resizeControllerType: MouseControllerTarget,
    private readonly _rotateControllerType: MouseControllerTarget,
    private readonly _getCenter: () => IPoint,
    private readonly _coefficients: {
      x: -1 | 1
      y: -1 | 1
    }
  ) {}

  get x() {
    return this._getCenter().x - ActiveSelectionCorner._RESIZE_WIDTH / 2
  }

  get y() {
    return this._getCenter().y - ActiveSelectionCorner._RESIZE_HEIGHT / 2
  }

  get width() {
    return ActiveSelectionCorner._RESIZE_WIDTH
  }

  get height() {
    return ActiveSelectionCorner._RESIZE_HEIGHT
  }

  private _getRotateCenter() {
    const { x, y } = this._getCenter()
    const {
      _RESIZE_WIDTH: RESIZE_WIDTH,
      _RESIZE_HEIGHT: RESIZE_HEIGHT,
      _ROTATE_WIDTH: ROTATE_WIDTH,
      _ROTATE_HEIGHT: ROTATE_HEIGHT,
    } = ActiveSelectionCorner
    const centerX = ROTATE_WIDTH / 2 - RESIZE_WIDTH / 2
    const centerY = ROTATE_HEIGHT / 2 - RESIZE_HEIGHT / 2
    return {
      x: x + centerX * this._coefficients.x,
      y: y + centerY * this._coefficients.y,
    }
  }

  private _hitTestResize(point: IPoint) {
    const { x, y } = this._getCenter()
    const { _RESIZE_WIDTH: RESIZE_WIDTH, _RESIZE_HEIGHT: RESIZE_HEIGHT } =
      ActiveSelectionCorner
    const startX = x - RESIZE_WIDTH / 2
    const startY = y - RESIZE_HEIGHT / 2
    return inBox(startX, startY, RESIZE_WIDTH, RESIZE_HEIGHT, point.x, point.y)
  }

  private _hitTestRotate(point: IPoint) {
    const { x, y } = this._getRotateCenter()
    const { _ROTATE_WIDTH: ROTATE_WIDTH, _ROTATE_HEIGHT: ROTATE_HEIGHT } =
      ActiveSelectionCorner
    const startX = x - ROTATE_WIDTH / 2
    const startY = y - ROTATE_HEIGHT / 2
    return inBox(startX, startY, ROTATE_WIDTH, ROTATE_HEIGHT, point.x, point.y)
  }

  public hitTest(point: IPoint) {
    if (this._hitTestResize(point)) {
      return this._resizeControllerType
    }
    if (this._hitTestRotate(point)) {
      return this._rotateControllerType
    }
    return null
  }
}

class ActiveSelectionCornerCollection {
  private _corners: ActiveSelectionCorner[] = []

  constructor(private _activeSelection: ActiveSelection) {
    this._createCorner()
  }

  public getCorners(): ActiveSelectionCorner[] {
    return this._corners
  }

  private _createCorner() {
    // lt
    this._corners.push(
      new ActiveSelectionCorner(
        MouseControllerTarget.SELECT_RESIZE_LEFT_TOP,
        MouseControllerTarget.SELECT_ROTATE_LEFT_TOP,
        this._leftTopCornerCenter,
        {
          x: -1,
          y: -1,
        }
      )
    )

    // rt
    this._corners.push(
      new ActiveSelectionCorner(
        MouseControllerTarget.SELECT_RESIZE_RIGHT_TOP,
        MouseControllerTarget.SELECT_ROTATE_RIGHT_TOP,
        this._rightTopCornerCenter,
        {
          x: 1,
          y: -1,
        }
      )
    )

    // lb
    this._corners.push(
      new ActiveSelectionCorner(
        MouseControllerTarget.SELECT_RESIZE_LEFT_BOTTOM,
        MouseControllerTarget.SELECT_ROTATE_LEFT_BOTTOM,
        this._leftBottomCornerCenter,
        {
          x: -1,
          y: 1,
        }
      )
    )

    // rb
    this._corners.push(
      new ActiveSelectionCorner(
        MouseControllerTarget.SELECT_RESIZE_RIGHT_BOTTOM,
        MouseControllerTarget.SELECT_ROTATE_RIGHT_BOTTOM,
        this._rightBottomCornerCenter,
        {
          x: 1,
          y: 1,
        }
      )
    )
  }

  private _leftTopCornerCenter = () => ({ x: 0, y: 0 })

  private _rightTopCornerCenter = () => {
    const { OBB } = this._activeSelection

    return {
      x: OBB.width,
      y: 0,
    }
  }

  private _leftBottomCornerCenter = () => {
    const { OBB } = this._activeSelection
    return { x: 0, y: OBB.height }
  }

  private _rightBottomCornerCenter = () => {
    const { OBB } = this._activeSelection
    return {
      x: OBB.width,
      y: OBB.height,
    }
  }

  public hitTest(point: IPoint) {
    let result: MouseControllerTarget | null = null
    this._corners.some(item => {
      result = item.hitTest(point)
      return !!result
    })
    return result
  }
}

export class ActiveSelection extends Rect {
  static INACTIVE: boolean = true
  private _objects: DisplayObject[] = []
  private _OBBDirty: boolean = false
  private _cornerCollection: ActiveSelectionCornerCollection

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
    this._cornerCollection = new ActiveSelectionCornerCollection(this)
  }

  public addSelectElement = (element: DisplayObject) => {
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

  override getBounds() {
    if (this._objects.length === 1) {
      return this._objects[0].getBounds()
    }
    super.getBounds()
    return this._bounds
  }

  public hasActive() {
    return !!this._objects.length
  }

  public hasSelected = (element: DisplayObject) =>
    this._objects.includes(element)

  public getCorners() {
    return this._cornerCollection.getCorners()
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
    return this._cornerCollection.hitTest(point)
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

  public isActive() {
    return this._objects.length > 0
  }

  public override inactive(): boolean {
    return true
  }
}
