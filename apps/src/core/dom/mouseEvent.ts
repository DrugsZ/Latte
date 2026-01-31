import type { PickService } from 'Latte/core/services/pick/pickService'
import type { MouseControllerTarget } from 'Latte/core/selection/activeSelection'
import type DisplayObject from 'Latte/core/elements/container'
import * as dom from 'Latte/core/dom/dom'
import { create } from 'Latte/utils/vector'

const tempVec2 = create(0, 0)

import {
  StandardMouseEvent,
  DropMouseEvent,
  StandardWheelEvent,
  MouseDownState,
  type IMouseEvent,
  type IMouseWheelEvent,
  type IPoint,
} from '@latte-js/syrup'

export {
  StandardMouseEvent,
  DropMouseEvent,
  StandardWheelEvent,
  MouseDownState,
  type IMouseEvent,
  type IMouseWheelEvent,
  type IPoint,
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
