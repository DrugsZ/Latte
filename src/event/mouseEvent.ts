import type { PickService } from 'Latte/event/pickService'
import type { MouseControllerTarget } from 'Latte/core/activeSelection'
import type DisplayObject from 'Latte/core/container'

export const EventType = {
  // Mouse
  CLICK: 'click',
  AUXCLICK: 'auxclick',
  DBLCLICK: 'dblclick',
  MOUSE_UP: 'mouseup',
  MOUSE_DOWN: 'mousedown',
  MOUSE_OVER: 'mouseover',
  MOUSE_MOVE: 'mousemove',
  MOUSE_OUT: 'mouseout',
  MOUSE_ENTER: 'mouseenter',
  MOUSE_LEAVE: 'mouseleave',
  MOUSE_WHEEL: 'wheel',
  POINTER_UP: 'pointerup',
  POINTER_DOWN: 'pointerdown',
  POINTER_MOVE: 'pointermove',
  POINTER_LEAVE: 'pointerleave',
  CONTEXT_MENU: 'contextmenu',
  WHEEL: 'wheel',
} as const

export interface IMouseEvent {
  readonly browserEvent: MouseEvent
  readonly leftButton: boolean
  readonly middleButton: boolean
  readonly rightButton: boolean
  readonly buttons: number
  readonly detail: number
  readonly offsetX: number
  readonly offsetY: number
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly metaKey: boolean
  readonly timestamp: number
}

export class StandardMouseEvent implements IMouseEvent {
  public readonly browserEvent: MouseEvent

  public readonly leftButton: boolean
  public readonly middleButton: boolean
  public readonly rightButton: boolean
  public readonly buttons: number
  public readonly button: number
  public detail: number
  public readonly offsetX: number
  public readonly offsetY: number
  public readonly ctrlKey: boolean
  public readonly shiftKey: boolean
  public readonly altKey: boolean
  public readonly metaKey: boolean
  public readonly timestamp: number

  constructor(e: MouseEvent) {
    this.timestamp = Date.now()
    this.browserEvent = e
    this.leftButton = e.button === 0
    this.middleButton = e.button === 1
    this.rightButton = e.button === 2
    this.buttons = e.buttons
    this.button = e.button

    this.detail = e.detail || 1
    if (e.type === 'dblclick') {
      this.detail = 2
    }
    this.ctrlKey = e.ctrlKey
    this.shiftKey = e.shiftKey
    this.altKey = e.altKey
    this.metaKey = e.metaKey
    this.offsetX = e.offsetX
    this.offsetY = e.offsetY
  }
}

export class EditorMouseEvent extends StandardMouseEvent {
  constructor(
    e: MouseEvent,
    public readonly client: IPoint,
    public readonly target: DisplayObject,
    public readonly controllerTargetType: MouseControllerTarget
  ) {
    super(e)
  }
}

export class EditorMouseEventFactory {
  constructor(
    private readonly _viewDom: HTMLElement,
    private readonly _client2Viewport: (point: IPoint) => IPoint,
    private readonly _pickService: PickService
  ) {}

  private _create(e: MouseEvent): EditorMouseEvent {
    const client = this._client2Viewport({ x: e.offsetX, y: e.offsetY })
    const elementTarget = this._pickService.pick(client)
    const controller = this._pickService.pickActiveSelection(client)
    return new EditorMouseEvent(e, client, elementTarget, controller)
  }

  public onContextMenu(callback: (e: EditorMouseEvent) => void) {
    this._viewDom.addEventListener(EventType.CONTEXT_MENU, (e: MouseEvent) => {
      callback(this._create(e))
    })
  }

  public onMouseUp(callback: (e: EditorMouseEvent) => void) {
    this._viewDom.addEventListener(EventType.MOUSE_UP, (e: MouseEvent) => {
      callback(this._create(e))
    })
  }

  public onMouseDown(callback: (e: EditorMouseEvent) => void) {
    this._viewDom.addEventListener(EventType.MOUSE_DOWN, (e: MouseEvent) => {
      callback(this._create(e))
    })
  }

  public onPointerDown(
    callback: (e: EditorMouseEvent, pointerId: number) => void
  ) {
    this._viewDom.addEventListener(
      EventType.POINTER_DOWN,
      (e: PointerEvent) => {
        callback(this._create(e), e.pointerId)
      }
    )
  }

  public onPointerMove(
    callback: (e: EditorMouseEvent, pointerId: number) => void
  ) {
    this._viewDom.addEventListener(
      EventType.POINTER_MOVE,
      (e: PointerEvent) => {
        callback(this._create(e), e.pointerId)
      }
    )
  }

  public onPointerUp(
    callback: (e: EditorMouseEvent, pointerId: number) => void
  ) {
    this._viewDom.addEventListener(EventType.POINTER_UP, (e: PointerEvent) => {
      callback(this._create(e), e.pointerId)
    })
  }

  public onMouseLeave(callback: (e: EditorMouseEvent) => void) {
    this._viewDom.addEventListener(EventType.MOUSE_LEAVE, (e: MouseEvent) => {
      callback(this._create(e))
    })
  }

  public onMouseMove(callback: (e: EditorMouseEvent) => void) {
    this._viewDom.addEventListener(EventType.MOUSE_MOVE, (e: MouseEvent) => {
      callback(this._create(e))
    })
  }
}
