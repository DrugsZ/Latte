import type View from 'Latte/core/view'
import type { ViewController } from 'Latte/core/viewController'
import { Point } from 'Latte/common/Point'
import type { PickService } from 'Latte/event/pickService'
import type { EditorMouseEvent, IMouseWheelEvent } from 'Latte/event/mouseEvent'
import {
  EditorMouseEventFactory,
  StandardWheelEvent,
  EventType,
} from 'Latte/event/mouseEvent'
import type { DisplayObject } from 'Latte/core/displayObject'
import type { MouseControllerTarget } from 'Latte/core/activeSelection'

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

  private _targetObject: DisplayObject
  public get targetObject(): DisplayObject {
    return this._targetObject
  }

  private _lastMouseControllerTarget: MouseControllerTarget
  public get lastMouseControllerTarget(): MouseControllerTarget {
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

  public setStartControls(source: EditorMouseEvent) {
    this._lastMouseControllerTarget = source.controllerTargetType
  }

  public setStartTarget(source: EditorMouseEvent) {
    this._targetObject = source.target
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
    this._mouseDownState.setStartControls(event)
    this._mouseDownState.setStartTarget(event)
    this._startMonitoring()
    this._dispatchMouse(false, event)
    this._lastMouseEvent = event
  }

  private _startMonitoring() {
    this._isActive = true
  }

  private _stopMonitoring() {
    this._isActive = false
  }

  private _onMouseDownThenMove = (e: EditorMouseEvent) => {
    if (!this._isActive) {
      return
    }
    this._dispatchMouse(true, e)
    this._lastMouseEvent = e
  }

  public onMouseUp(event: EditorMouseEvent) {
    if (
      this._mouseDownState.lastMouseDownPosition?.equals(event.client) &&
      this._mouseDownState.lastMouseControllerTarget ===
        event.controllerTargetType
    ) {
      this._viewController.setSelectElement(event.target, event.shiftKey)
    }
    this._stopMonitoring()
  }

  public isActive() {
    return this._isActive
  }

  private _dispatchMouse(inSelectionMode: boolean, event: EditorMouseEvent) {
    this._viewController.dispatchMouse({
      target: this._mouseDownState.targetObject,
      controllerTargetType: this._mouseDownState.lastMouseControllerTarget,
      position: event.client,
      startPosition: this._mouseDownState.lastMouseDownPosition,
      inSelectionMode,
      altKey: this._mouseDownState.altKey,
      ctrlKey: this._mouseDownState.ctrlKey,
      metaKey: this._mouseDownState.metaKey,
      shiftKey: this._mouseDownState.shiftKey,
      mouseDownCount: this._mouseDownState.count,
      prePosition: this._lastMouseEvent ? this._lastMouseEvent.client : null,

      leftButton: this._mouseDownState.leftButton,
      rightButton: this._mouseDownState.rightButton,
      browserEvent: event.browserEvent,
    })
  }
}

export class MouseHandler {
  private _isMouseDown: boolean
  private _mouseDownOperation: MouseDownOperation
  private _mouseEvent: EditorMouseEventFactory
  constructor(
    private readonly _view: View,
    private readonly _viewController: ViewController,
    private readonly _element: HTMLCanvasElement,
    private readonly _pickService: PickService
  ) {
    this._mouseEvent = new EditorMouseEventFactory(
      this._element,
      this._view.client2Viewport,
      this._pickService
    )
    this._mouseDownOperation = new MouseDownOperation(
      this._mouseEvent,
      this._viewController
    )
    this._mouseEvent.onMouseDown(this._bindMouseDownHandler)
    this._mouseEvent.onMouseUp(this._bindMouseUpHandler)
    this._mouseEvent.onMouseMove(this._bindMouseMoveHandler)
    this._setupMouseWheelZoomListener()
  }

  private _bindMouseDownHandler = (e: EditorMouseEvent) => {
    this._isMouseDown = true
    if (e.button === 0) {
      this._mouseDownOperation.start(e)
    }
  }

  private _bindMouseUpHandler = (e: EditorMouseEvent) => {
    this._mouseDownOperation.onMouseUp(e)
    this._isMouseDown = false
    this._viewController.emitMouseUp(e)
  }

  private _bindMouseMoveHandler = (e: EditorMouseEvent) => {
    if (this._mouseDownOperation.isActive()) {
      return
    }
    this._viewController.dispatchMouse({
      target: e.target,
      controllerTargetType: e.controllerTargetType,
      position: e.client,
      prePosition: null,

      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      inSelectionMode: false,
      mouseDownCount: 0,
      leftButton: e.leftButton,
      rightButton: e.rightButton,
      browserEvent: e.browserEvent,
    })
  }

  private _setupMouseWheelZoomListener(): void {
    const onMouseWheel = (browserEvent: IMouseWheelEvent) => {
      const client = this._view.client2Viewport({
        x: browserEvent.offsetX,
        y: browserEvent.offsetY,
      })
      this._viewController.dispatchWheel(
        new StandardWheelEvent(browserEvent, client)
      )
    }
    this._element.addEventListener(EventType.MOUSE_WHEEL, onMouseWheel, {
      capture: true,
      passive: false,
    })
  }
}
