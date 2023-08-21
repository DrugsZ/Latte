import type View from 'Latte/core/view'
import type { EventTarget } from 'Latte/core/eventTarget'
import type { ViewController } from 'Latte/core/viewController'
import { FormattedPointerEvent } from 'Latte/event/eventBind'
import { Point } from 'Latte/common/Point'

class MouseDownState {
  private static readonly CLEAR_MOUSE_DOWN_COUNT_TIME = 400 // ms

  private _altKey: boolean
  public get altKey(): boolean {
    return this._altKey
  }

  private _ctrlKey: boolean
  public get ctrlKey(): boolean {
    return this._ctrlKey
  }

  private _metaKey: boolean
  public get metaKey(): boolean {
    return this._metaKey
  }

  private _shiftKey: boolean
  public get shiftKey(): boolean {
    return this._shiftKey
  }

  private _leftButton: boolean
  public get leftButton(): boolean {
    return this._leftButton
  }

  private _rightButton: boolean
  public get rightButton(): boolean {
    return this._rightButton
  }

  private _lastMouseDownPosition: Point | null
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
    this._lastMouseDownPosition = null
    this._lastMouseDownPositionEqualCount = 0
    this._lastMouseDownCount = 0
    this._lastSetMouseDownCountTime = 0
  }

  public get count(): number {
    return this._lastMouseDownCount
  }

  public setModifiers(source: FormattedPointerEvent) {
    this._altKey = source.altKey
    this._ctrlKey = source.ctrlKey
    this._metaKey = source.metaKey
    this._shiftKey = source.shiftKey
  }

  public setStartButtons(e: FormattedPointerEvent) {
    this._leftButton = e.button === 0
    this._rightButton = e.button === 2
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

class MouseDownOperation {
  private _mouseDownState: MouseDownState

  constructor(private readonly _viewController: ViewController) {}

  public start(event: FormattedPointerEvent) {
    this._mouseDownState.setModifiers(event)
    this._mouseDownState.setStartButtons(event)
    this._mouseDownState.trySetCount(
      event.detail,
      new Point(event.clientX, event.clientY)
    )
  }

  private _dispatchMouse() {}
}

class MouseHandler {
  private _isMouseDown: boolean
  private _mouseDownOperation: MouseDownOperation
  constructor(
    private readonly _element: EventTarget,
    private readonly _view: View,
    private readonly _viewController: ViewController
  ) {
    this._bindMouseDownHandler()
    this._bindMouseMoveHandler()
    this._bindMouseUpHandler()
    this._mouseDownOperation = new MouseDownOperation(this._viewController)
  }

  private _bindMouseDownHandler() {
    this._element.addEventListener('mousedown', e => {
      this._isMouseDown = true
      this._mouseDownOperation.start(e)
      this._viewController.mouseDownOnCanvas(e)
    })
  }

  private _bindMouseUpHandler() {
    this._element.addEventListener('mouseup', () => {
      this._isMouseDown = false
    })
  }

  private _bindMouseMoveHandler() {
    this._element.addEventListener('mousemove', e => {
      if (!this._isMouseDown) {
        return
      }
      const newX = (e as MouseEvent).movementX
      const newY = (e as MouseEvent).movementY
      const currentCamera = this._view.getCurrentCamera()
      const vpMatrix = currentCamera.getViewPortMatrix()
      currentCamera.move(-newX / vpMatrix.a, -newY / vpMatrix.d)
    })
  }
}

export default MouseHandler
