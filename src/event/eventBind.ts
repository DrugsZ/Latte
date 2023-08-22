import type { EventService } from 'Latte/event/eventService'
import { FederatedPointerEvent } from 'Latte/core/federatedPointerEvent'
import type { FederatedMouseEvent } from 'Latte/core/federatedMouseEvent'
import { FederatedWheelEvent } from 'Latte/core/federatedWheelEvent'
import type { IPickerService } from 'Latte/event/pickService'
import { Point } from 'Latte/common/Point'

export const TOUCH_TO_POINTER: Record<string, string> = {
  touchstart: 'pointerdown',
  touchend: 'pointerup',
  touchendoutside: 'pointerupoutside',
  touchmove: 'pointermove',
  touchcancel: 'pointercancel',
}

export interface FormattedPointerEvent extends PointerEvent {
  isPrimary: boolean
  width: number
  height: number
  tiltX: number
  tiltY: number
  pointerType: string
  pointerId: number
  pressure: number
  twist: number
  tangentialPressure: number
  isNormalized: boolean
  type: string
}

export interface FormattedTouch extends Touch {
  button: number
  buttons: number
  isPrimary: boolean
  width: number
  height: number
  tiltX: number
  tiltY: number
  pointerType: string
  pointerId: number
  pressure: number
  twist: number
  tangentialPressure: number
  layerY: number
  offsetX: number
  offsetY: number
  isNormalized: boolean
  type: string
}

const MOUSE_POINTER_ID = 1

export class EventBind {
  private _rootPointerEvent = new FederatedPointerEvent(null)
  private _rootWheelEvent = new FederatedWheelEvent(null)

  private readonly _supportsTouchEvents = 'ontouchstart' in globalThis

  private readonly _supportsPointerEvents = !!globalThis.PointerEvent

  constructor(
    private readonly _view: HTMLCanvasElement,
    private readonly _eventService: EventService,
    private readonly _pickService: IPickerService,
    private readonly client2Viewport: (client: IPoint) => IPoint
  ) {
    this._onPointerDown = this._onPointerDown.bind(this)
    this._onPointerMove = this._onPointerMove.bind(this)
    this._onPointerUp = this._onPointerUp.bind(this)
    this._onPointerOver = this._onPointerOver.bind(this)
    this._onWheel = this._onWheel.bind(this)
    this._init()
  }

  private _init() {
    if (this._supportsPointerEvents) {
      this._view.addEventListener('pointerdown', this._onPointerDown.bind(this))
      this._view.addEventListener('pointermove', this._onPointerMove.bind(this))
      this._view.addEventListener('pointerup', this._onPointerUp.bind(this))
      this._view.addEventListener('pointerover', this._onPointerOver.bind(this))
    } else {
      this._view.addEventListener('mousedown', this._onPointerDown.bind(this))
      this._view.addEventListener('mousemove', this._onPointerMove.bind(this))
      this._view.addEventListener('mouseup', this._onPointerUp.bind(this))
      this._view.addEventListener('mouseover', this._onPointerOver.bind(this))
    }

    this._view.addEventListener('wheel', this._onWheel, {
      passive: true,
      capture: true,
    })

    this._eventService.setPickHandler(this._pickService.pick)
  }

  private _normalizeToPointerData(
    event: TouchEvent | MouseEvent | PointerEvent
  ): PointerEvent[] {
    const normalizedEvents: any[] = []

    if (this._supportsTouchEvents && event instanceof TouchEvent) {
      for (let i = 0, li = event.changedTouches.length; i < li; i++) {
        const touch = event.changedTouches[i] as FormattedTouch

        if (typeof touch.button === 'undefined') touch.button = 0
        if (typeof touch.buttons === 'undefined') touch.buttons = 1
        if (typeof touch.isPrimary === 'undefined') {
          touch.isPrimary =
            event.touches.length === 1 && event.type === 'touchstart'
        }
        if (typeof touch.width === 'undefined') touch.width = touch.radiusX || 1
        if (typeof touch.height === 'undefined')
          touch.height = touch.radiusY || 1
        if (typeof touch.tiltX === 'undefined') touch.tiltX = 0
        if (typeof touch.tiltY === 'undefined') touch.tiltY = 0
        if (typeof touch.pointerType === 'undefined')
          touch.pointerType = 'touch'
        if (typeof touch.pointerId === 'undefined')
          touch.pointerId = touch.identifier || 0
        if (typeof touch.pressure === 'undefined')
          touch.pressure = touch.force || 0.5
        if (typeof touch.twist === 'undefined') touch.twist = 0
        if (typeof touch.tangentialPressure === 'undefined')
          touch.tangentialPressure = 0

        // mark the touch as normalized, just so that we know we did it
        touch.isNormalized = true
        touch.type = event.type

        normalizedEvents.push(touch)
      }
    }
    // apparently PointerEvent subclasses MouseEvent, so yay
    else if (
      !globalThis.MouseEvent ||
      (event instanceof MouseEvent &&
        (!this._supportsPointerEvents ||
          !(event instanceof globalThis.PointerEvent)))
    ) {
      const tempEvent = event as FormattedPointerEvent

      if (typeof tempEvent.isPrimary === 'undefined') tempEvent.isPrimary = true
      if (typeof tempEvent.width === 'undefined') tempEvent.width = 1
      if (typeof tempEvent.height === 'undefined') tempEvent.height = 1
      if (typeof tempEvent.tiltX === 'undefined') tempEvent.tiltX = 0
      if (typeof tempEvent.tiltY === 'undefined') tempEvent.tiltY = 0
      if (typeof tempEvent.pointerType === 'undefined')
        tempEvent.pointerType = 'mouse'
      if (typeof tempEvent.pointerId === 'undefined')
        tempEvent.pointerId = MOUSE_POINTER_ID
      if (typeof tempEvent.pressure === 'undefined') tempEvent.pressure = 0.5
      if (typeof tempEvent.twist === 'undefined') tempEvent.twist = 0
      if (typeof tempEvent.tangentialPressure === 'undefined')
        tempEvent.tangentialPressure = 0

      // mark the mouse event as normalized, just so that we know we did it
      tempEvent.isNormalized = true

      normalizedEvents.push(tempEvent)
    } else {
      normalizedEvents.push(event)
    }

    return normalizedEvents as PointerEvent[]
  }

  private _normalizeWheelEvent(nativeEvent: WheelEvent): FederatedWheelEvent {
    const event = this._rootWheelEvent

    this.transferMouseData(event, nativeEvent)
    event.deltaX = nativeEvent.deltaX
    event.deltaY = nativeEvent.deltaY
    event.deltaZ = nativeEvent.deltaZ
    event.deltaMode = nativeEvent.deltaMode

    const { x, y } = this.client2Viewport({
      x: nativeEvent.offsetX,
      y: nativeEvent.offsetY,
    })
    event.canvas = new Point(x, y)
    event.global.copyFrom(event.screen)
    event.offset.copyFrom(event.screen)

    event.nativeEvent = nativeEvent
    event.type = nativeEvent.type

    return event
  }

  private transferMouseData(
    event: FederatedMouseEvent,
    nativeEvent: MouseEvent
  ): void {
    event.isTrusted = nativeEvent.isTrusted
    event.timeStamp = performance.now()
    event.type = nativeEvent.type

    event.altKey = nativeEvent.altKey
    event.button = nativeEvent.button
    event.buttons = nativeEvent.buttons
    event.client.x = nativeEvent.clientX
    event.client.y = nativeEvent.clientY
    event.ctrlKey = nativeEvent.ctrlKey
    event.metaKey = nativeEvent.metaKey
    event.movement.x = nativeEvent.movementX
    event.movement.y = nativeEvent.movementY
    event.page.x = nativeEvent.pageX
    event.page.y = nativeEvent.pageY
    event.relatedTarget = null
    event.shiftKey = nativeEvent.shiftKey
  }

  private bootstrapEvent(
    event: FederatedPointerEvent,
    nativeEvent: PointerEvent
  ): FederatedPointerEvent {
    event.originalEvent = null
    event.nativeEvent = nativeEvent

    event.pointerId = nativeEvent.pointerId
    event.width = nativeEvent.width
    event.height = nativeEvent.height
    event.isPrimary = nativeEvent.isPrimary
    event.pointerType = nativeEvent.pointerType
    event.pressure = nativeEvent.pressure
    event.tangentialPressure = nativeEvent.tangentialPressure
    event.tiltX = nativeEvent.tiltX
    event.tiltY = nativeEvent.tiltY
    event.twist = nativeEvent.twist
    this.transferMouseData(event, nativeEvent)
    const { x, y } = this.client2Viewport({
      x: nativeEvent.offsetX,
      y: nativeEvent.offsetY,
    })
    event.canvas = new Point(x, y)
    event.global.copyFrom(event.canvas)
    event.offset.copyFrom(event.canvas)

    event.isTrusted = nativeEvent.isTrusted
    if (event.type === 'pointerleave') {
      event.type = 'pointerout'
    }
    if (event.type.startsWith('mouse')) {
      event.type = event.type.replace('mouse', 'pointer')
    }
    if (event.type.startsWith('touch')) {
      event.type = TOUCH_TO_POINTER[event.type] || event.type
    }
    return event
  }

  private _onPointerDown(nativeEvent: MouseEvent) {
    const events = this._normalizeToPointerData(nativeEvent)
    for (let i = 0, j = events.length; i < j; i++) {
      const nativeEvent = events[i]
      const federatedEvent = this.bootstrapEvent(
        this._rootPointerEvent,
        nativeEvent
      )
      this._eventService.mapEvent(federatedEvent)
    }
  }

  private _onPointerMove(nativeEvent: MouseEvent) {
    if (
      this._supportsTouchEvents &&
      (nativeEvent as PointerEvent).pointerType === 'touch'
    ) {
      return
    }

    const events = this._normalizeToPointerData(nativeEvent)
    for (let i = 0, j = events.length; i < j; i++) {
      const nativeEvent = events[i]
      const federatedEvent = this.bootstrapEvent(
        this._rootPointerEvent,
        nativeEvent
      )

      this._eventService.mapEvent(federatedEvent)
    }
  }

  private _onPointerUp(nativeEvent: MouseEvent) {
    if (
      this._supportsTouchEvents &&
      (nativeEvent as PointerEvent).pointerType === 'touch'
    ) {
      return
    }
    const $element = this._view

    let outside = 'outside'
    try {
      outside =
        $element &&
        nativeEvent.target &&
        nativeEvent.target !== $element &&
        $element.contains &&
        !$element.contains(nativeEvent.target as Node)
          ? 'outside'
          : ''
    } catch (e) {
      // nativeEvent.target maybe not Node, such as Window
      // @see https://github.com/antvis/G/issues/1235
    }
    const events = this._normalizeToPointerData(nativeEvent)
    for (let i = 0, j = events.length; i < j; i++) {
      const nativeEvent = events[i]
      const federatedEvent = this.bootstrapEvent(
        this._rootPointerEvent,
        nativeEvent
      )
      federatedEvent.type += outside
      this._eventService.mapEvent(federatedEvent)
    }
  }

  private _onPointerOver(nativeEvent: MouseEvent) {
    if (
      this._supportsTouchEvents &&
      (nativeEvent as PointerEvent).pointerType === 'touch'
    ) {
      return
    }

    const events = this._normalizeToPointerData(nativeEvent)
    for (let i = 0, j = events.length; i < j; i++) {
      const nativeEvent = events[i]
      const federatedEvent = this.bootstrapEvent(
        this._rootPointerEvent,
        nativeEvent
      )

      this._eventService.mapEvent(federatedEvent)
    }
  }

  private _onWheel(nativeEvent: WheelEvent): void {
    const wheelEvent = this._normalizeWheelEvent(nativeEvent)

    this._eventService.mapEvent(wheelEvent)
  }
}
