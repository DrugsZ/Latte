import { Disposable, Emitter, type Event } from '@latte-js/kit'

import {
  StandardMouseEvent,
  StandardWheelEvent,
  type IPoint,
} from '../../dom/mouseEvent'
import { createDecorator } from '../instantiation/instantiation'

import type { HitResult, ILatteEvent, IMouseWheelEvent } from '@latte-js/bean'
import type { IHitTestResult, IHitTestService } from '../hitTest/hitTestService'

export enum EventResult {
  IGNORED = 0,
  CONSUMED = 1,
}

export interface IInputService {
  readonly onKeyDown: Event<KeyboardEvent>
  readonly onKeyUp: Event<KeyboardEvent>
  registerHandler(handler: IInputMouseHandler): void
  removeHandler(id: string): void
  capturePointer(pointerId: number, handlerId: string): void
  releasePointer(pointerId: number, handlerId?: string): void
}

export const IInputService = createDecorator<IInputService>('inputService')

export type InputEditorEvent = InputMouseEvent | InputWheelEvent

interface IInputEventDispatchContext {
  capturePointer(pointerId: number, handlerId: string): void
  releasePointer(pointerId: number, handlerId?: string): void
}

class InputEventState {
  private _activeHandlerId: string | null = null
  private _defaultPrevented = false
  private _propagationStopped = false

  constructor(
    private readonly _browserEvent: MouseEvent | IMouseWheelEvent,
    private readonly _capture: IInputEventDispatchContext,
    private readonly _pointerId?: number
  ) {}

  public get pointerId() {
    return this._pointerId
  }

  public get defaultPrevented() {
    return this._defaultPrevented
  }

  public get propagationStopped() {
    return this._propagationStopped
  }

  public setActiveHandler(id: string | null) {
    this._activeHandlerId = id
  }

  public preventDefault() {
    this._defaultPrevented = true
    this._browserEvent.preventDefault()
  }

  public stopPropagation() {
    this._propagationStopped = true
    this._browserEvent.stopPropagation()
  }

  public capturePointer(pointerId = this._pointerId) {
    if (pointerId === undefined || this._activeHandlerId === null) {
      return
    }
    this._capture.capturePointer(pointerId, this._activeHandlerId)
  }

  public releasePointer(pointerId = this._pointerId) {
    if (pointerId === undefined || this._activeHandlerId === null) {
      return
    }
    this._capture.releasePointer(pointerId, this._activeHandlerId)
  }
}

export class InputMouseEvent extends StandardMouseEvent implements ILatteEvent {
  public readonly hitResult: HitResult | undefined
  public readonly viewport: IPoint
  public readonly world: IPoint
  /**
   * @deprecated Use `world`. This field keeps the previous editor-event shape
   * while consumers migrate to explicit coordinate spaces.
   */
  public readonly client: IPoint

  constructor(
    browserEvent: MouseEvent,
    hitTest: IHitTestResult,
    private readonly _state: InputEventState
  ) {
    super(browserEvent)
    this.hitResult = hitTest.hitResult
    this.viewport = hitTest.viewport
    this.world = hitTest.world
    this.client = hitTest.world
  }

  public get pointerId() {
    return this._state.pointerId
  }

  public get defaultPrevented() {
    return this._state.defaultPrevented
  }

  public get propagationStopped() {
    return this._state.propagationStopped
  }

  public preventDefault() {
    this._state.preventDefault()
  }

  public stopPropagation() {
    this._state.stopPropagation()
  }

  public capturePointer(pointerId = this.pointerId) {
    this._state.capturePointer(pointerId)
  }

  public releasePointer(pointerId = this.pointerId) {
    this._state.releasePointer(pointerId)
  }

  public _setDispatchHandler(id: string | null) {
    this._state.setActiveHandler(id)
  }
}

export class InputWheelEvent extends StandardWheelEvent {
  public readonly hitResult: HitResult | undefined
  public readonly viewport: IPoint
  public readonly world: IPoint

  constructor(
    browserEvent: IMouseWheelEvent,
    hitTest: IHitTestResult,
    private readonly _state: InputEventState
  ) {
    super(browserEvent, hitTest.world)
    this.hitResult = hitTest.hitResult
    this.viewport = hitTest.viewport
    this.world = hitTest.world
  }

  public get pointerId() {
    return this._state.pointerId
  }

  public get defaultPrevented() {
    return this._state.defaultPrevented
  }

  public get propagationStopped() {
    return this._state.propagationStopped
  }

  public override preventDefault() {
    this._state.preventDefault()
  }

  public override stopPropagation() {
    this._state.stopPropagation()
  }

  public capturePointer(pointerId = this.pointerId) {
    this._state.capturePointer(pointerId)
  }

  public releasePointer(pointerId = this.pointerId) {
    this._state.releasePointer(pointerId)
  }

  public _setDispatchHandler(id: string | null) {
    this._state.setActiveHandler(id)
  }
}

export interface IInputMouseHandler {
  id: string
  priority: number // Higher priority first
  onEvent(e: InputEditorEvent): EventResult
}

// TODO(input-runtime): Move this DOM-bound implementation out of syrup once
// the shared input contracts are stable. Crema or a dedicated input package is
// a better long-term home for browser target wiring and hit-test adaptation.
export class InputService extends Disposable implements IInputService {
  private _handlers: IInputMouseHandler[] = []
  private readonly _capturedPointers = new Map<number, string>()

  private readonly _onKeyDown = this._register(new Emitter<KeyboardEvent>())
  public readonly onKeyDown = this._onKeyDown.event

  private readonly _onKeyUp = this._register(new Emitter<KeyboardEvent>())
  public readonly onKeyUp = this._onKeyUp.event

  constructor(
    private readonly _target: HTMLElement,
    private _hitTestService: IHitTestService,
    private readonly _keyTarget: Window = window
  ) {
    super()
    this._target.addEventListener('pointerdown', this._handleRaw)
    this._target.addEventListener('pointermove', this._handleRaw)
    this._target.addEventListener('pointerup', this._handleRaw)
    this._target.addEventListener('pointercancel', this._handleRaw)
    this._target.addEventListener('dblclick', this._handleRaw)
    this._target.addEventListener('wheel', this._handleRaw, { passive: false })
    this._target.addEventListener('contextmenu', this._handleRaw)
    this._keyTarget.addEventListener('keydown', this._handleKeyDown)
    this._keyTarget.addEventListener('keyup', this._handleKeyUp)
  }

  public setHitTestService(service: IHitTestService) {
    this._hitTestService = service
  }

  public registerHandler(handler: IInputMouseHandler) {
    this._handlers.push(handler)
    this._handlers.sort((a, b) => b.priority - a.priority)
  }

  public removeHandler(id: string) {
    this._handlers = this._handlers.filter(h => h.id !== id)
    for (const [pointerId, handlerId] of this._capturedPointers) {
      if (handlerId === id) {
        this._capturedPointers.delete(pointerId)
      }
    }
  }

  public capturePointer(pointerId: number, handlerId: string) {
    this._capturedPointers.set(pointerId, handlerId)
  }

  public releasePointer(pointerId: number, handlerId?: string) {
    const owner = this._capturedPointers.get(pointerId)
    if (owner === undefined) {
      return
    }
    if (handlerId !== undefined && owner !== handlerId) {
      return
    }
    this._capturedPointers.delete(pointerId)
  }

  public override dispose() {
    this._target.removeEventListener('pointerdown', this._handleRaw)
    this._target.removeEventListener('pointermove', this._handleRaw)
    this._target.removeEventListener('pointerup', this._handleRaw)
    this._target.removeEventListener('pointercancel', this._handleRaw)
    this._target.removeEventListener('dblclick', this._handleRaw)
    this._target.removeEventListener('wheel', this._handleRaw)
    this._target.removeEventListener('contextmenu', this._handleRaw)
    this._keyTarget.removeEventListener('keydown', this._handleKeyDown)
    this._keyTarget.removeEventListener('keyup', this._handleKeyUp)
    super.dispose()
  }

  private _handleKeyDown = (e: KeyboardEvent) => {
    this._onKeyDown.fire(e)
  }

  private _handleKeyUp = (e: KeyboardEvent) => {
    this._onKeyUp.fire(e)
  }

  private _handleRaw = (rawEvent: MouseEvent | WheelEvent) => {
    const hitTest = this._hitTestService.hitTest(
      rawEvent.clientX,
      rawEvent.clientY
    )
    const pointerId = this._getPointerId(rawEvent)
    const state = new InputEventState(rawEvent, this, pointerId)

    let event: InputEditorEvent

    if (rawEvent.type === 'wheel') {
      event = new InputWheelEvent(rawEvent as IMouseWheelEvent, hitTest, state)
    } else {
      event = new InputMouseEvent(rawEvent as PointerEvent, hitTest, state)
    }

    for (const handler of this._getDispatchHandlers(event)) {
      event._setDispatchHandler(handler.id)
      const result = handler.onEvent(event)
      event._setDispatchHandler(null)

      if (
        result === EventResult.CONSUMED ||
        event.propagationStopped ||
        event.defaultPrevented
      ) {
        if (result === EventResult.CONSUMED && !event.defaultPrevented) {
          event.preventDefault()
        }
        break
      }
    }

    if (
      this._shouldReleasePointerCapture(rawEvent) &&
      pointerId !== undefined
    ) {
      this.releasePointer(pointerId)
    }
  }

  private _getDispatchHandlers(event: InputEditorEvent) {
    const pointerId = event.pointerId
    if (pointerId !== undefined) {
      const capturedHandlerId = this._capturedPointers.get(pointerId)
      if (capturedHandlerId !== undefined) {
        const capturedHandler = this._handlers.find(
          handler => handler.id === capturedHandlerId
        )
        if (capturedHandler) {
          return [capturedHandler]
        }
        this._capturedPointers.delete(pointerId)
      }
    }

    return [...this._handlers]
  }

  private _getPointerId(rawEvent: MouseEvent | WheelEvent) {
    return typeof (rawEvent as PointerEvent).pointerId === 'number'
      ? (rawEvent as PointerEvent).pointerId
      : undefined
  }

  private _shouldReleasePointerCapture(rawEvent: MouseEvent | WheelEvent) {
    return rawEvent.type === 'pointerup' || rawEvent.type === 'pointercancel'
  }
}
