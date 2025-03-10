import type { PickService } from 'Latte/core/services/pick/pickService'
import type { MouseControllerTarget } from 'Latte/core/selection/activeSelection'
import type DisplayObject from 'Latte/core/elements/container'
import * as dom from 'Latte/core/dom/dom'
import { Vector } from 'Latte/common/vector'

const tempVec2 = Vector.create(0, 0)

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

export class DropMouseEvent extends StandardMouseEvent {
  public readonly dataTransfer: DataTransfer

  constructor(e: MouseEvent) {
    super(e)
    this.dataTransfer = (<any>e).dataTransfer
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

export interface PickProxy {
  pick: PickService['pick']
  pickActiveSelection: PickService['pickActiveSelection']
}

export class EditorMouseEventFactory {
  constructor(
    private readonly _viewDom: HTMLElement,
    private readonly _client2Viewport: (vec: ReadonlyVec2) => ReadonlyVec2,
    private readonly _pickProxy: PickProxy
  ) {}

  private _create(e: MouseEvent): EditorMouseEvent {
    tempVec2[0] = e.offsetX
    tempVec2[1] = e.offsetY
    const client = this._client2Viewport(tempVec2)
    const elementTarget = this._pickProxy.pick(client)
    const controller = this._pickProxy.pickActiveSelection(client)
    return new EditorMouseEvent(
      e,
      {
        x: client[0],
        y: client[1],
      },
      elementTarget,
      controller
    )
  }

  public onContextMenu(callback: (e: EditorMouseEvent) => void) {
    this._viewDom.addEventListener(
      dom.EventType.CONTEXT_MENU,
      (e: MouseEvent) => {
        callback(this._create(e))
      }
    )
  }

  public onMouseUp(callback: (e: EditorMouseEvent) => void) {
    this._viewDom.addEventListener(dom.EventType.MOUSE_UP, (e: MouseEvent) => {
      callback(this._create(e))
    })
  }

  public onMouseDown(callback: (e: EditorMouseEvent) => void) {
    this._viewDom.addEventListener(
      dom.EventType.MOUSE_DOWN,
      (e: MouseEvent) => {
        callback(this._create(e))
      }
    )
  }

  public onPointerDown(
    callback: (e: EditorMouseEvent, pointerId: number) => void
  ) {
    this._viewDom.addEventListener(
      dom.EventType.POINTER_DOWN,
      (e: PointerEvent) => {
        callback(this._create(e), e.pointerId)
      }
    )
  }

  public onPointerMove(
    callback: (e: EditorMouseEvent, pointerId: number) => void
  ) {
    this._viewDom.addEventListener(
      dom.EventType.POINTER_MOVE,
      (e: PointerEvent) => {
        callback(this._create(e), e.pointerId)
      }
    )
  }

  public onPointerUp(
    callback: (e: EditorMouseEvent, pointerId: number) => void
  ) {
    this._viewDom.addEventListener(
      dom.EventType.POINTER_UP,
      (e: PointerEvent) => {
        callback(this._create(e), e.pointerId)
      }
    )
  }

  public onMouseLeave(callback: (e: EditorMouseEvent) => void) {
    this._viewDom.addEventListener(
      dom.EventType.MOUSE_LEAVE,
      (e: MouseEvent) => {
        callback(this._create(e))
      }
    )
  }

  public onMouseMove(callback: (e: EditorMouseEvent) => void) {
    this._viewDom.addEventListener(
      dom.EventType.MOUSE_MOVE,
      (e: MouseEvent) => {
        callback(this._create(e))
      }
    )
  }
}

export interface IMouseWheelEvent extends MouseEvent {
  readonly deltaX: number
  readonly deltaY: number
  readonly deltaZ: number
  readonly deltaMode: number
}

export class StandardWheelEvent {
  public readonly browserEvent: IMouseWheelEvent | null
  public readonly deltaY: number
  public readonly deltaX: number
  public readonly target: Node
  public readonly ctrlKey: boolean
  public readonly shiftKey: boolean
  public readonly altKey: boolean
  public readonly metaKey: boolean
  public readonly speed: number

  constructor(
    e: IMouseWheelEvent,
    public readonly client: IPoint,
    speed?: number
  ) {
    this.browserEvent = e || null
    this.target = e ? e.target || (<any>e).targetNode || e.srcElement : null

    this.deltaY = e.deltaY
    this.deltaX = e.deltaX
    this.ctrlKey = e.ctrlKey
    this.shiftKey = e.shiftKey
    this.altKey = e.altKey
    this.metaKey = e.metaKey
    this.speed = speed || this.deltaY
  }

  public preventDefault(): void {
    this.browserEvent?.preventDefault()
  }

  public stopPropagation(): void {
    this.browserEvent?.stopPropagation()
  }
}
