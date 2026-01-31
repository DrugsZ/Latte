import { type IPoint } from '@latte-js/kit'

export { type IPoint }

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
