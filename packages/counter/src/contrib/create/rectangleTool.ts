import { CreationPreviewType } from '../../overlay/creationPreviewState'

import type {
  ICreateRectangleOptions,
  IDType,
  IMouseEvent,
  INodeService,
  ITool,
} from '@latte-js/bean'
import type { CreationPreviewStore } from '../../overlay/creationPreviewState'
import type { SelectionService } from '../../services/selection/selectionService'

export enum CreationToolId {
  Rectangle = 'rectangle-tool',
}

export enum RectangleCreationPhase {
  Idle = 'idle',
  Dragging = 'dragging',
  Committing = 'committing',
}

interface RectangleCreationPointerEvent extends IMouseEvent {
  readonly pointerId?: number
  readonly world: { x: number; y: number }
  capturePointer(pointerId?: number): void
  releasePointer(pointerId?: number): void
  preventDefault(): void
}

interface ActiveRectangleCreation {
  readonly pointerId?: number
  readonly parentId: IDType
  readonly originWorld: { x: number; y: number }
  latestWorld: { x: number; y: number }
  phase: RectangleCreationPhase
}

export interface RectangleToolOptions {
  readonly nodeService: INodeService
  readonly selectionService: SelectionService
  readonly previewStore: CreationPreviewStore
  readonly getParentId: () => IDType | null
  readonly createId?: () => IDType
}

const MIN_RECTANGLE_SIZE = 1

export class RectangleTool implements ITool {
  public readonly id = CreationToolId.Rectangle

  private _active: ActiveRectangleCreation | null = null
  private _nextId = 1

  constructor(private readonly _options: RectangleToolOptions) {}

  public activate() {}

  public deactivate() {
    this._clearInteraction()
  }

  public onPointerDown(e: IMouseEvent) {
    const event = this._asPointerEvent(e)
    const parentId = this._options.getParentId()
    if (!event || !parentId || this._active) {
      return
    }

    this._active = {
      pointerId: event.pointerId,
      parentId,
      originWorld: { ...event.world },
      latestWorld: { ...event.world },
      phase: RectangleCreationPhase.Dragging,
    }
    this._updatePreview(this._active)
    event.capturePointer()
    event.preventDefault()
  }

  public onPointerMove(e: IMouseEvent) {
    const event = this._asPointerEvent(e)
    const state = this._active
    if (!event || !state || !this._matchesPointer(state, event)) {
      return
    }

    state.latestWorld = { ...event.world }
    this._updatePreview(state)
    event.preventDefault()
  }

  public onPointerUp(e: IMouseEvent) {
    const event = this._asPointerEvent(e)
    const state = this._active
    if (!event || !state || !this._matchesPointer(state, event)) {
      return
    }

    state.latestWorld = { ...event.world }
    state.phase = RectangleCreationPhase.Committing
    event.releasePointer()
    event.preventDefault()
    void this._commit(state)
  }

  public onPointerCancel(e: IMouseEvent) {
    const event = this._asPointerEvent(e)
    const state = this._active
    if (!event || !state || !this._matchesPointer(state, event)) {
      return
    }

    event.releasePointer()
    event.preventDefault()
    this._clearInteraction()
  }

  private async _commit(state: ActiveRectangleCreation) {
    const options = this._createRectangleOptions(state)
    this._clearInteraction()

    if (!this._isValidRectangle(options)) {
      return
    }

    const id = await this._options.nodeService.createRectangle(
      state.parentId,
      options
    )
    this._options.selectionService.select([id])
  }

  private _createRectangleOptions(
    state: ActiveRectangleCreation
  ): ICreateRectangleOptions {
    const bounds = this._normalizeWorldRect(
      state.originWorld,
      state.latestWorld
    )
    return {
      id: this._createId(),
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    }
  }

  private _updatePreview(state: ActiveRectangleCreation) {
    const bounds = this._normalizeWorldRect(
      state.originWorld,
      state.latestWorld
    )
    this._options.previewStore.set({
      type: CreationPreviewType.Rectangle,
      bounds: {
        minX: bounds.x,
        minY: bounds.y,
        maxX: bounds.x + bounds.width,
        maxY: bounds.y + bounds.height,
      },
    })
  }

  private _clearInteraction() {
    this._active = null
    this._options.previewStore.clear()
  }

  private _normalizeWorldRect(
    a: { x: number; y: number },
    b: { x: number; y: number }
  ) {
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    return {
      x,
      y,
      width: Math.max(a.x, b.x) - x,
      height: Math.max(a.y, b.y) - y,
    }
  }

  private _isValidRectangle(options: ICreateRectangleOptions) {
    return (
      Number.isFinite(options.x) &&
      Number.isFinite(options.y) &&
      options.width >= MIN_RECTANGLE_SIZE &&
      options.height >= MIN_RECTANGLE_SIZE
    )
  }

  private _matchesPointer(
    state: ActiveRectangleCreation,
    event: RectangleCreationPointerEvent
  ) {
    return state.pointerId === undefined || state.pointerId === event.pointerId
  }

  private _asPointerEvent(
    event: IMouseEvent
  ): RectangleCreationPointerEvent | null {
    const candidate = event as Partial<RectangleCreationPointerEvent>
    if (
      !candidate.world ||
      typeof candidate.capturePointer !== 'function' ||
      typeof candidate.releasePointer !== 'function' ||
      typeof candidate.preventDefault !== 'function'
    ) {
      return null
    }
    return candidate as RectangleCreationPointerEvent
  }

  private _createId(): IDType {
    return this._options.createId?.() ?? `rectangle:${this._nextId++}`
  }
}
