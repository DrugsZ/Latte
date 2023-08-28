import type View from 'Latte/core/view'
import type { EventTarget } from 'Latte/core/eventTarget'
import type { ViewController } from 'Latte/core/viewController'
import type { FormattedPointerEvent } from 'Latte/event/eventBind'
import { Point } from 'Latte/common/Point'
import Rect from 'Latte/elements/rect'
import { PickService } from 'Latte/event/pickService'
import {
  EditorMouseEventFactory,
  EditorMouseEvent,
} from 'Latte/event/mouseEvent'
import { DisplayObject } from 'Latte/core/displayObject'
import { MouseControllerTarget } from 'Latte/core/activeSelection'

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
  public get lastMouseDownPosition(): Point | null {
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
    this._lastMouseDownPosition = null
    this._lastMouseDownPositionEqualCount = 0
    this._lastMouseDownCount = 0
    this._lastSetMouseDownCountTime = 0
  }

  public get count(): number {
    return this._lastMouseDownCount
  }

  public setModifiers(source: EditorMouseEvent) {
    this._altKey = source.altKey
    this._ctrlKey = source.ctrlKey
    this._metaKey = source.metaKey
    this._shiftKey = source.shiftKey
  }

  public setStartButtons(source: EditorMouseEvent) {
    this._leftButton = source.leftButton
    this._rightButton = source.rightButton
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
  private _mouseDownState: MouseDownState = new MouseDownState()
  private _isActive: boolean = false
  private _initialElement: DisplayObject | null = null
  private _lastMouseEvent: EditorMouseEvent | null

  constructor(
    private readonly _mouseEvent: EditorMouseEventFactory,
    private readonly _viewController: ViewController
  ) {
    this._mouseEvent.onMouseMove(this._onMouseDownThenMove)
    this._lastMouseEvent = null
  }

  public start(event: EditorMouseEvent) {
    this._lastMouseEvent = event
    this._mouseDownState.setModifiers(event)
    this._mouseDownState.setStartButtons(event)
    this._mouseDownState.trySetCount(
      event.detail,
      new Point(event.client.x, event.client.y)
    )
    this._startMonitoring(event)
    this._dispatchMouse(
      event.target,
      false,
      event.client,
      event.controllerTargetType
    )
  }

  private _startMonitoring(event: EditorMouseEvent) {
    this._isActive = true
    if (event.target instanceof Rect) {
      this._initialElement = event.target
    }
  }

  private _stopMonitoring(event: EditorMouseEvent) {
    this._isActive = false
    this._initialElement = null
  }

  private _onMouseDownThenMove = (e: EditorMouseEvent) => {
    if (!this._isActive) {
      return
    }
    if (!this._initialElement) {
      return
    }
    this._dispatchMouse(e.target, true, e.client, e.controllerTargetType)
    this._lastMouseEvent = e
  }

  public onPointerUp(event: EditorMouseEvent) {
    this._stopMonitoring(event)
  }

  public isActive() {
    return this._isActive
  }

  private _dispatchMouse(
    target: DisplayObject,
    inSelectionMode: boolean,
    point: IPoint,
    controllerTargetType: MouseControllerTarget
  ) {
    const movement = new Point(0, 0)
    if (this._lastMouseEvent) {
      const { _lastMouseEvent } = this
      movement.x = point.x - _lastMouseEvent.client.x
      movement.y = point.y - _lastMouseEvent.client.y
    }
    this._viewController.dispatchMouse({
      target,
      controllerTargetType,
      position: point,
      inSelectionMode,
      altKey: this._mouseDownState.altKey,
      ctrlKey: this._mouseDownState.ctrlKey,
      metaKey: this._mouseDownState.metaKey,
      shiftKey: this._mouseDownState.shiftKey,
      mouseDownCount: this._mouseDownState.count,
      movement,

      leftButton: this._mouseDownState.leftButton,
      rightButton: this._mouseDownState.rightButton,
    })
  }
}

class MouseHandler {
  private _isMouseDown: boolean
  private _mouseDownOperation: MouseDownOperation
  private _mouseEvent: EditorMouseEventFactory
  constructor(
    private readonly _element: EventTarget,
    private readonly _view: View,
    private readonly _viewController: ViewController,
    private readonly element: HTMLCanvasElement,
    private readonly pickService: PickService
  ) {
    this._mouseEvent = new EditorMouseEventFactory(
      this.element,
      this._view.client2Viewport,
      this.pickService
    )
    this._mouseDownOperation = new MouseDownOperation(
      this._mouseEvent,
      this._viewController
    )
    this._mouseEvent.onMouseDown(this._bindMouseDownHandler)
    this._mouseEvent.onMouseUp(this._bindMouseUpHandler)
    this._mouseEvent.onMouseMove(this._bindMouseMoveHandler)
  }

  private _bindMouseDownHandler = (e: EditorMouseEvent) => {
    // this._isMouseDown = true
    if (e.button === 0) {
      this._mouseDownOperation.start(e)
    }
  }

  private _bindMouseUpHandler = (e: EditorMouseEvent) => {
    this._mouseDownOperation.onPointerUp(e)
    this._isMouseDown = false
  }

  private _bindMouseMoveHandler = (e: EditorMouseEvent) => {
    if (!this._isMouseDown) {
      return
    }
    const newX = e.browserEvent.movementX
    const newY = e.browserEvent.movementY
    const currentCamera = this._view.getCurrentCamera()
    const vpMatrix = currentCamera.getViewPortMatrix()
    currentCamera.move(-newX / vpMatrix.a, -newY / vpMatrix.d)
  }
}

export default MouseHandler
