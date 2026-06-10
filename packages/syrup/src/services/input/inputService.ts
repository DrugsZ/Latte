import { Disposable, Emitter, type Event } from '@latte-js/kit'

import {
  StandardMouseEvent,
  StandardWheelEvent,
  type IPoint,
} from '../../dom/mouseEvent'
import { createDecorator } from '../instantiation/instantiation'

import type { HitResult, ILatteEvent, IMouseWheelEvent } from '@latte-js/bean'

export enum EventResult {
  IGNORED = 0,
  CONSUMED = 1,
}

export interface IInputService {
  readonly onKeyDown: Event<KeyboardEvent>
  readonly onKeyUp: Event<KeyboardEvent>
}

export const IInputService = createDecorator<IInputService>('inputService')

export interface IInputHitTestResult {
  hitResult: HitResult | undefined
  client: IPoint
}

export interface IInputHitTestProvider {
  hitTest(clientX: number, clientY: number): IInputHitTestResult
}

export class InputMouseEvent extends StandardMouseEvent implements ILatteEvent {
  constructor(
    browserEvent: MouseEvent,
    public readonly hitResult: HitResult | undefined,
    public readonly client: IPoint
  ) {
    super(browserEvent)
  }
}

export class InputWheelEvent extends StandardWheelEvent {
  constructor(
    browserEvent: IMouseWheelEvent,
    public readonly hitResult: HitResult | undefined,
    client: IPoint
  ) {
    super(browserEvent, client)
  }
}

export interface IInputMouseHandler {
  id: string
  priority: number // Higher priority first
  onEvent(e: InputMouseEvent | InputWheelEvent): EventResult
}

export class InputService extends Disposable implements IInputService {
  private _handlers: IInputMouseHandler[] = []

  private readonly _onKeyDown = this._register(new Emitter<KeyboardEvent>())
  public readonly onKeyDown = this._onKeyDown.event

  private readonly _onKeyUp = this._register(new Emitter<KeyboardEvent>())
  public readonly onKeyUp = this._onKeyUp.event

  constructor(
    private readonly _target: HTMLElement,
    private _hitTestProvider: IInputHitTestProvider,
    private readonly _keyTarget: Window = window
  ) {
    super()
    this._target.addEventListener('pointerdown', this._handleRaw)
    this._target.addEventListener('pointermove', this._handleRaw)
    this._target.addEventListener('pointerup', this._handleRaw)
    this._target.addEventListener('dblclick', this._handleRaw)
    this._target.addEventListener('wheel', this._handleRaw, { passive: false })
    this._target.addEventListener('contextmenu', this._handleRaw)
    this._keyTarget.addEventListener('keydown', this._handleKeyDown)
    this._keyTarget.addEventListener('keyup', this._handleKeyUp)
  }

  public setHitTestProvider(provider: IInputHitTestProvider) {
    this._hitTestProvider = provider
  }

  public registerHandler(handler: IInputMouseHandler) {
    this._handlers.push(handler)
    this._handlers.sort((a, b) => b.priority - a.priority)
  }

  public removeHandler(id: string) {
    this._handlers = this._handlers.filter(h => h.id !== id)
  }

  public override dispose() {
    this._target.removeEventListener('pointerdown', this._handleRaw)
    this._target.removeEventListener('pointermove', this._handleRaw)
    this._target.removeEventListener('pointerup', this._handleRaw)
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
    const { hitResult, client } = this._hitTestProvider.hitTest(
      rawEvent.clientX,
      rawEvent.clientY
    )

    let event: InputMouseEvent | InputWheelEvent

    if (rawEvent instanceof WheelEvent) {
      event = new InputWheelEvent(
        rawEvent as IMouseWheelEvent,
        hitResult,
        client
      )
    } else {
      event = new InputMouseEvent(rawEvent as PointerEvent, hitResult, client)
    }

    for (const handler of this._handlers) {
      const result = handler.onEvent(event)
      if (result === EventResult.CONSUMED) {
        rawEvent.preventDefault()
        break
      }
    }
  }
}
