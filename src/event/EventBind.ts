import type { EventService } from 'Latte/event/EventService'

export class EventBind {
  constructor(
    private readonly _view: HTMLCanvasElement,
    private _eventService: EventService
  ) {
    this._init()
  }

  private _init() {
    this._view.addEventListener('mousedown', this._onPointerDown.bind(this))
    this._view.addEventListener('mousemove', this._onPointerMove.bind(this))
    this._view.addEventListener('mouseup', this._onPointerUp.bind(this))
  }

  private _onPointerDown(e: MouseEvent) {
    this._eventService.mapEvent(e)
  }

  private _onPointerMove(e: MouseEvent) {
    this._eventService.mapEvent(e)
  }

  private _onPointerUp(e: MouseEvent) {
    this._eventService.mapEvent(e)
  }
}
