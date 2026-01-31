import type View from 'Latte/core/view'
import type { ViewController } from 'Latte/core/view/viewController'
import { Point } from 'Latte/utils/point'
import type {
  EditorMouseEvent,
  IMouseWheelEvent,
  PickProxy,
} from 'Latte/core/dom/mouseEvent'
import {
  EditorMouseEventFactory,
  StandardWheelEvent,
  MouseDownState,
} from 'Latte/core/dom/mouseEvent'
import type { DisplayObject } from 'Latte/core/elements/displayObject'
import type { MouseControllerTarget } from 'Latte/core/selection/activeSelection'
import * as dom from 'Latte/core/dom/dom'

import { create } from 'Latte/utils/vector'

const tempVec2 = create(0, 0)

class MouseDownOperation {
  private _mouseDownState = new MouseDownState<
    DisplayObject,
    MouseControllerTarget
  >()
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
    this._mouseDownState.setStartControls(event.controllerTargetType)
    this._mouseDownState.setStartTarget(event.target)
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
    private readonly _pickProxy: PickProxy
  ) {
    this._mouseEvent = new EditorMouseEventFactory(
      this._element,
      this._view.client2Viewport,
      this._pickProxy
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

  private _preventWheelDefault(e: MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
    }
  }

  private _setupMouseWheelZoomListener(): void {
    let speedTimer: number | null = null
    let speed = 0
    const calcSpeed = (e: IMouseWheelEvent) => {
      speed += e.deltaY
      if (!speedTimer) {
        speedTimer = window.setTimeout(() => {
          speedTimer = null
          speed = 0
        }, 50)
      }
      return speed
    }
    const onMouseWheel = (browserEvent: IMouseWheelEvent) => {
      tempVec2[0] = browserEvent.offsetX
      tempVec2[1] = browserEvent.offsetY
      this._preventWheelDefault(browserEvent)
      const client = this._view.client2Viewport(tempVec2)
      const speed = calcSpeed(browserEvent)
      this._viewController.dispatchWheel(
        new StandardWheelEvent(
          browserEvent,
          {
            x: client[0],
            y: client[1],
          },
          speed
        )
      )
    }
    this._element.addEventListener(dom.EventType.MOUSE_WHEEL, onMouseWheel, {
      capture: true,
      passive: false,
    })
  }
}
