import type { EventService } from 'Latte/event/EventService'

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

export class EventBind {
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

  private _onPointerDown(nativeEvent: MouseEvent) {
    const event = EventBind.normalizeToPointerData(nativeEvent)
    this._eventService.mapEvent(event)
    this._eventService.setPickHandler(this._pickService.pick)
  }

  private _onPointerMove(e: MouseEvent) {
    this._eventService.mapEvent(e)
  }

  private _onPointerUp(e: MouseEvent) {
    this._eventService.mapEvent(e)
  }
}
