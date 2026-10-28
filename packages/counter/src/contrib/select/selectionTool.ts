import { EventResult, InputMouseEvent } from '@latte-js/syrup'

import type { IDType, vec2 } from '@latte-js/bean'
import type { IInputMouseHandler, InputWheelEvent } from '@latte-js/syrup'
import type { SelectionService } from '../../services/selection/selectionService'

export interface ITransformInteraction {
  beginTransform(ids: IDType[], label?: string): Promise<void>
  moveBy(ids: IDType[], delta: vec2): void
  commitTransform(): Promise<void>
  cancelTransform(): Promise<void>
}

interface DragState {
  readonly ids: IDType[]
  readonly origin: vec2
  delta: vec2
  started: boolean
  readonly begin: Promise<void>
}

export class SelectionTool implements IInputMouseHandler {
  public readonly id = 'selection-tool'
  public priority = 100
  private _drag: DragState | null = null

  constructor(
    private readonly _selectionService: SelectionService,
    private readonly _transformInteraction?: ITransformInteraction
  ) {}

  onEvent(e: InputMouseEvent | InputWheelEvent): EventResult {
    if (!(e instanceof InputMouseEvent)) {
      return EventResult.IGNORED
    }

    if (e.browserEvent?.type === 'pointerdown') {
      return this._handlePointerDown(e)
    }

    if (e.browserEvent?.type === 'pointermove') {
      return this._handlePointerMove(e)
    }

    if (
      e.browserEvent?.type === 'pointerup' ||
      e.browserEvent?.type === 'pointercancel'
    ) {
      const wasDragging = this._drag !== null
      this._handlePointerEnd(e, e.browserEvent.type === 'pointercancel')
      return wasDragging ? EventResult.CONSUMED : EventResult.IGNORED
    }

    return EventResult.IGNORED
  }

  private _handlePointerDown(e: InputMouseEvent): EventResult {
    const isMultiSelect = e.ctrlKey || e.metaKey || e.shiftKey
    if (e.hitResult?.kind === 'render-layer') {
      return EventResult.IGNORED
    }

    const hitNodeId = e.hitResult?.nodeId

    if (hitNodeId !== undefined) {
      if (isMultiSelect) {
        this._selectionService.toggle(hitNodeId)
      } else {
        if (!this._selectionService.has(hitNodeId)) {
          this._selectionService.select([hitNodeId])
        }
        this._beginDrag(e)
      }
      return EventResult.CONSUMED
    } else {
      if (!isMultiSelect) {
        this._selectionService.clear()
      }
    }

    return EventResult.IGNORED
  }

  private _beginDrag(e: InputMouseEvent) {
    if (!this._transformInteraction || this._selectionService.isEmpty) {
      return
    }

    const ids = this._selectionService.ids
    const origin: vec2 = [e.world.x, e.world.y]
    const begin = this._transformInteraction.beginTransform(
      ids,
      'Move selection'
    )
    const drag: DragState = {
      ids,
      origin,
      delta: [0, 0],
      started: false,
      begin,
    }
    this._drag = drag
    e.capturePointer()

    void begin
      .then(() => {
        if (this._drag !== drag) {
          return this._transformInteraction?.cancelTransform()
        }
        drag.started = true
        this._flushDrag(drag)
      })
      .catch(() => {
        if (this._drag === drag) {
          this._drag = null
          e.releasePointer()
        }
      })
  }

  private _handlePointerMove(e: InputMouseEvent) {
    const drag = this._drag
    if (!drag) {
      return EventResult.IGNORED
    }

    drag.delta = [e.world.x - drag.origin[0], e.world.y - drag.origin[1]]
    this._flushDrag(drag)
    return EventResult.CONSUMED
  }

  private _flushDrag(drag: DragState) {
    if (!drag.started || this._drag !== drag) {
      return
    }

    this._transformInteraction?.moveBy(drag.ids, drag.delta)
  }

  private _handlePointerEnd(e: InputMouseEvent, cancel: boolean) {
    const drag = this._drag
    if (!drag) {
      return
    }

    this._drag = null
    e.releasePointer()

    void drag.begin
      .then(async () => {
        if (cancel) {
          await this._transformInteraction?.cancelTransform()
        } else {
          await this._transformInteraction?.commitTransform()
        }
      })
      .catch(() => undefined)
  }
}
