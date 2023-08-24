import { EventTarget } from 'Latte/core/eventTarget'

export enum MouseControllerTarget {
  BLANK,
  SELECTION_CONTEXT,
  SELECT_ROTATE_LEFT_TOP,
  SELECT_ROTATE_RIGHT_TOP,
  SELECT_ROTATE_LEFT_BOTTOM,
  SELECT_ROTATE_RIGHT_BOTTOM,
  SELECT_RESIZE_LEFT,
  SELECT_RESIZE_TOP,
  SELECT_RESIZE_RIGHT,
  SELECT_RESIZE_BOTTOM,
  SELECT_RESIZE_LEFT_TOP,
  SELECT_RESIZE_RIGHT_TOP,
  SELECT_RESIZE_LEFT_BOTTOM,
  SELECT_RESIZE_RIGHT_BOTTOM,
}

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
	// Keyboard
	KEY_DOWN: 'keydown',
	KEY_PRESS: 'keypress',
	KEY_UP: 'keyup',
	// HTML Document
	LOAD: 'load',
	BEFORE_UNLOAD: 'beforeunload',
	UNLOAD: 'unload',
	PAGE_SHOW: 'pageshow',
	PAGE_HIDE: 'pagehide',
	ABORT: 'abort',
	ERROR: 'error',
	RESIZE: 'resize',
	SCROLL: 'scroll',
	FULLSCREEN_CHANGE: 'fullscreenchange',
	WK_FULLSCREEN_CHANGE: 'webkitfullscreenchange',
	// Form
	SELECT: 'select',
	CHANGE: 'change',
	SUBMIT: 'submit',
	RESET: 'reset',
	FOCUS: 'focus',
	FOCUS_IN: 'focusin',
	FOCUS_OUT: 'focusout',
	BLUR: 'blur',
	INPUT: 'input',
	// Local Storage
	STORAGE: 'storage',
	// Drag
	DRAG_START: 'dragstart',
	DRAG: 'drag',
	DRAG_ENTER: 'dragenter',
	DRAG_LEAVE: 'dragleave',
	DRAG_OVER: 'dragover',
	DROP: 'drop',
	DRAG_END: 'dragend',
	// Animation
	// ANIMATION_START: browser.isWebKit ? 'webkitAnimationStart' : 'animationstart',
	// ANIMATION_END: browser.isWebKit ? 'webkitAnimationEnd' : 'animationend',
	// ANIMATION_ITERATION: browser.isWebKit ? 'webkitAnimationIteration' : 'animationiteration'
} as const;

export interface IMouseEvent {
  readonly browserEvent: MouseEvent
  readonly leftButton: boolean
  readonly middleButton: boolean
  readonly rightButton: boolean
  readonly buttons: number
  readonly target: EventTarget | null
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
  public readonly target: EventTarget | null
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
  readonly controllerTargetType: MouseControllerTarget
  constructor(e: MouseEvent) {
    super(e)
  }
}

export class EditorMouseEventFactory {
  private readonly _editorViewDomNode: HTMLElement

  constructor(editorViewDomNode: HTMLElement) {
    this._editorViewDomNode = editorViewDomNode
  }

  private _create(e: MouseEvent): EditorMouseEvent {
    return new EditorMouseEvent(e, false, this._editorViewDomNode)
  }

  public onContextMenu(
    target: HTMLElement,
    callback: (e: EditorMouseEvent) => void
  ): IDisposable {
    return dom.addDisposableListener(target, 'contextmenu', (e: MouseEvent) => {
      callback(this._create(e))
    })
  }

  public onMouseUp(
    target: HTMLElement,
    callback: (e: EditorMouseEvent) => void
  ): IDisposable {
    return dom.addDisposableListener(target, 'mouseup', (e: MouseEvent) => {
      callback(this._create(e))
    })
  }

  public onMouseDown(
    target: HTMLElement,
    callback: (e: EditorMouseEvent) => void
  ): IDisposable {
    return dom.addDisposableListener(
      target,
      dom.EventType.MOUSE_DOWN,
      (e: MouseEvent) => {
        callback(this._create(e))
      }
    )
  }

  public onPointerDown(
    target: HTMLElement,
    callback: (e: EditorMouseEvent, pointerId: number) => void
  ): IDisposable {
    return dom.addDisposableListener(
      target,
      dom.EventType.POINTER_DOWN,
      (e: PointerEvent) => {
        callback(this._create(e), e.pointerId)
      }
    )
  }

  public onMouseLeave(
    target: HTMLElement,
    callback: (e: EditorMouseEvent) => void
  ):  {
    return dom.addDisposableListener(
      target,
      dom.EventType.MOUSE_LEAVE,
      (e: MouseEvent) => {
        callback(this._create(e))
      }
    )
  }

  public onMouseMove(
    target: HTMLElement,
    callback: (e: EditorMouseEvent) => void
  ): IDisposable {
    return dom.addDisposableListener(target, 'mousemove', e =>
      callback(this._create(e))
    )
  }
}
