import type { IMouseEvent } from '@latte-js/bean'
import type { Point } from '@latte-js/kit'

export class MouseDownState<TTarget, TController> {
  private static readonly CLEAR_MOUSE_DOWN_COUNT_TIME = 400 // ms

  private _altKey: boolean = false
  public get altKey(): boolean {
    return this._altKey
  }

  private _ctrlKey: boolean = false
  public get ctrlKey(): boolean {
    return this._ctrlKey
  }

  private _metaKey: boolean = false
  public get metaKey(): boolean {
    return this._metaKey
  }

  private _shiftKey: boolean = false
  public get shiftKey(): boolean {
    return this._shiftKey
  }

  private _leftButton: boolean = false
  public get leftButton(): boolean {
    return this._leftButton
  }

  private _rightButton: boolean = false
  public get rightButton(): boolean {
    return this._rightButton
  }

  private _targetObject: TTarget
  public get targetObject(): TTarget {
    return this._targetObject
  }

  private _lastMouseControllerTarget: TController
  public get lastMouseControllerTarget(): TController {
    return this._lastMouseControllerTarget
  }

  private _lastMouseDownPosition?: Point
  public get lastMouseDownPosition(): Point | undefined {
    return this._lastMouseDownPosition
  }

  private _lastMouseDownPositionEqualCount: number
  private _lastMouseDownCount: number
  private _lastSetMouseDownCountTime: number

  constructor() {
    this._altKey = false
    this._ctrlKey = false
    this._metaKey = false
    this._shiftKey = false
    this._leftButton = false
    this._rightButton = false
    this._lastMouseDownPosition = undefined
    this._lastMouseDownPositionEqualCount = 0
    this._lastMouseDownCount = 0
    this._lastSetMouseDownCountTime = 0
  }

  public get count(): number {
    return this._lastMouseDownCount
  }

  public setModifiers(source: IMouseEvent) {
    this._altKey = source.altKey
    this._ctrlKey = source.ctrlKey
    this._metaKey = source.metaKey
    this._shiftKey = source.shiftKey
  }

  public setStartButtons(source: IMouseEvent) {
    this._leftButton = source.leftButton
    this._rightButton = source.rightButton
  }

  public setStartControls(controller: TController) {
    this._lastMouseControllerTarget = controller
  }

  public setStartTarget(target: TTarget) {
    this._targetObject = target
  }

  public trySetCount(
    setMouseDownCount: number,
    newMouseDownPosition: Point
  ): void {
    const currentTime = new Date().getTime()
    if (
      currentTime - this._lastSetMouseDownCountTime >
      MouseDownState.CLEAR_MOUSE_DOWN_COUNT_TIME
    ) {
      setMouseDownCount = 1
    }
    this._lastSetMouseDownCountTime = currentTime

    if (setMouseDownCount > this._lastMouseDownCount + 1) {
      setMouseDownCount = this._lastMouseDownCount + 1
    }

    if (
      this._lastMouseDownPosition &&
      this._lastMouseDownPosition.equals(newMouseDownPosition)
    ) {
      this._lastMouseDownPositionEqualCount++
    } else {
      this._lastMouseDownPositionEqualCount = 1
    }
    this._lastMouseDownPosition = newMouseDownPosition

    this._lastMouseDownCount = Math.min(
      setMouseDownCount,
      this._lastMouseDownPositionEqualCount
    )
  }
}
