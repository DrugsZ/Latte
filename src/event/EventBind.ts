import type { EventService } from 'Latte/event/EventService'
import { FederatedPointerEvent } from 'Latte/core/FederatedPointerEvent'
import { FederatedMouseEvent } from 'Latte/core/FederatedMouseEvent'
import { FederatedWheelEvent } from 'Latte/core/FederatedWheelEvent'

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

const MOUSE_POINTER_ID = 1
import type { IPickerService } from 'Latte/event/PickService'
import { Point } from 'Latte/math/Point'

export class EventBind {
  private _rootPointerEvent = new FederatedPointerEvent(null)
  private _rootWheelEvent = new FederatedWheelEvent(null)

  constructor(
    private readonly _view: HTMLCanvasElement,
    private _eventService: EventService,
    private _pickService: IPickerService
  ) {
    this._init()
  }

  private _init() {
    this._view.addEventListener('mousedown', this._onPointerDown.bind(this))
    this._view.addEventListener('mousemove', this._onPointerMove.bind(this))
    this._view.addEventListener('mouseup', this._onPointerUp.bind(this))
    this._eventService.setPickHandler(this._pickService.pick)
  }

  private static normalizeToPointerData(
    event: TouchEvent | MouseEvent | PointerEvent
  ): PointerEvent {
    let normalizedEvents

    if (event instanceof MouseEvent) {
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

      normalizedEvents = tempEvent
    } else {
      normalizedEvents = event
    }

    return normalizedEvents as PointerEvent
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

    // this.mapPositionToPoint(
    //   event.canvas,
    //   nativeEvent.clientX,
    //   nativeEvent.clientY
    // )
    event.global.copyFrom(event.canvas)
    event.offset.copyFrom(event.canvas)

    event.isTrusted = nativeEvent.isTrusted
    if (event.type === 'pointerleave') {
      event.type = 'pointerout'
    }
    if (event.type.startsWith('mouse')) {
      event.type = event.type.replace('mouse', 'pointer')
    }

    return event
  }

  private _onPointerDown(nativeEvent: MouseEvent) {
    const event = EventBind.normalizeToPointerData(nativeEvent)
    this._eventService.mapEvent(event)
  }

  private _onPointerMove(e: MouseEvent) {
    this._eventService.mapEvent(e)
  }

  private _onPointerUp(e: MouseEvent) {
    this._eventService.mapEvent(e)
  }
}
