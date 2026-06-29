import {
  EventResult,
  type IInputMouseHandler,
  type InputEditorEvent,
  type InputMouseEvent,
} from '@latte-js/syrup'
import { NodeLifecycle, NULL_INDEX, type SceneGraph } from '@latte-js/espresso'

import {
  SELECTION_OVERLAY_LAYER_ID,
  SelectionOverlayHitType,
  type SelectionOverlayHitData,
} from '../overlay/selectionOverlayLayer'
import {
  DEFAULT_SELECTION_DRAG_THRESHOLD_PX,
  InputPointerEventType,
  SELECTION_INTERACTION_TOOL_ID,
  SelectionInteractionClickAction,
  SelectionInteractionIntent,
  SelectionInteractionScopeSource,
  SelectionOverlayInteractionKind,
  SelectionOverlayInteractionLabel,
  SelectionOverlayInteractionPhase,
} from './selectionOverlayInteractionTypes'

import {
  NodeType,
  type HitResult,
  type IDType,
  type mat2d,
  type vec2,
} from '@latte-js/bean'
import type {
  OverlayBounds,
  ResizeHandleDirection,
} from '../overlay/selectionOverlayGeometry'

export interface ISelectionTransformInteraction {
  readonly isActive: boolean
  beginTransform(ids: IDType[], label?: string): Promise<void>
  moveBy(ids: IDType[], totalDelta: vec2): void
  resize(ids: IDType[], width: number, height: number): void
  transformAround(ids: IDType[], matrix: mat2d, pivot: vec2): void
  commitTransform(): Promise<void>
  cancelTransform(): Promise<void>
}

export interface SelectionInteractionOpenScopeRequest {
  readonly source: SelectionInteractionScopeSource
  readonly nodeId: IDType
  readonly hitResult: HitResult
  readonly viewport: { x: number; y: number }
  readonly world: { x: number; y: number }
}

export interface SelectionInteractionToolOptions {
  readonly getSceneGraph?: () => SceneGraph
  readonly getSelectedIds?: () => readonly IDType[]
  readonly selectIds?: (ids: readonly IDType[]) => void
  readonly toggleId?: (id: IDType) => void
  readonly clearSelection?: () => void
  readonly openSelectionScope?: (
    request: SelectionInteractionOpenScopeRequest
  ) => boolean
  readonly dragThresholdPx?: number
}

export type SelectionOverlayInteractionToolOptions =
  SelectionInteractionToolOptions

interface PointerPoint {
  readonly x: number
  readonly y: number
}

interface PendingSelectionPointerInteraction {
  readonly phase: SelectionOverlayInteractionPhase.Pending
  readonly kind: SelectionOverlayInteractionKind
  readonly intent: SelectionInteractionIntent
  readonly ids: IDType[]
  readonly pointerId?: number
  readonly direction?: ResizeHandleDirection
  readonly originBounds?: OverlayBounds
  readonly originWorld: PointerPoint
  readonly originViewport: PointerPoint
  latestWorld: PointerPoint
  latestViewport: PointerPoint
  readonly clickAction: SelectionInteractionClickAction
  readonly clickTargetId?: IDType
  readonly dragSelectionIds?: IDType[]
}

interface ActiveSelectionPointerInteraction {
  readonly kind: SelectionOverlayInteractionKind
  readonly ids: IDType[]
  readonly pointerId?: number
  readonly direction?: ResizeHandleDirection
  readonly originBounds?: OverlayBounds
  readonly originWorld: PointerPoint
  latestWorld: PointerPoint
  phase:
    | SelectionOverlayInteractionPhase.Beginning
    | SelectionOverlayInteractionPhase.Active
    | SelectionOverlayInteractionPhase.Committing
    | SelectionOverlayInteractionPhase.Cancelling
  hasBegun: boolean
  beginFailed: boolean
  hasFlushedUpdate: boolean
  beginTask: Promise<void>
}

type SelectionPointerInteraction =
  | PendingSelectionPointerInteraction
  | ActiveSelectionPointerInteraction

export class SelectionInteractionTool implements IInputMouseHandler {
  public readonly id = SELECTION_INTERACTION_TOOL_ID
  public priority = 200

  private _interaction: SelectionPointerInteraction | null = null

  constructor(
    private readonly _transformInteraction: ISelectionTransformInteraction,
    private readonly _options: SelectionInteractionToolOptions = {}
  ) {}

  public onEvent(event: InputEditorEvent): EventResult {
    const type = event.browserEvent?.type
    if (type === InputPointerEventType.Down) {
      return this._handlePointerDown(event as InputMouseEvent)
    }
    if (type === InputPointerEventType.Move) {
      return this._handlePointerMove(event as InputMouseEvent)
    }
    if (type === InputPointerEventType.Up) {
      return this._handlePointerUp(event as InputMouseEvent)
    }
    if (type === InputPointerEventType.Cancel) {
      return this._handlePointerCancel(event as InputMouseEvent)
    }
    if (type === InputPointerEventType.DoubleClick) {
      return this._handleDoubleTap(event as InputMouseEvent)
    }
    return EventResult.IGNORED
  }

  private _handlePointerDown(event: InputMouseEvent): EventResult {
    if (this._interaction || !this._isPrimaryPointer(event)) {
      return EventResult.IGNORED
    }

    // TODO(interaction-router): Move hitResult classification out of this tool
    // into a counter-level InteractionRouter/HitResolver. This tool should
    // eventually consume normalized intents such as overlay-bounds,
    // resize-handle, selected-node, unselected-node, and empty-canvas instead
    // of deciding routing from raw hit-test data itself.
    const overlayHit = this._getSelectionOverlayHit(event.hitResult)
    if (overlayHit) {
      return this._handleOverlayPointerDown(event, overlayHit)
    }

    const hitNodeId = event.hitResult?.nodeId
    if (hitNodeId !== undefined) {
      return this._handleSceneNodePointerDown(event, hitNodeId)
    }

    return this._startPendingInteraction(event, {
      kind: SelectionOverlayInteractionKind.Marquee,
      intent: SelectionInteractionIntent.MarqueeSelection,
      ids: [],
      clickAction: this._isMultiSelect(event)
        ? SelectionInteractionClickAction.None
        : SelectionInteractionClickAction.Clear,
    })
  }

  private _handleOverlayPointerDown(
    event: InputMouseEvent,
    overlayHit: SelectionOverlayHitData
  ): EventResult {
    if (overlayHit.type === SelectionOverlayHitType.ResizeHandle) {
      return this._handleResizePointerDown(event, overlayHit)
    }

    if (overlayHit.ids.length === 0) {
      return EventResult.IGNORED
    }

    return this._startPendingInteraction(event, {
      kind: SelectionOverlayInteractionKind.Move,
      intent: SelectionInteractionIntent.MoveSelection,
      ids: [...overlayHit.ids],
      dragSelectionIds: [...overlayHit.ids],
      clickAction: SelectionInteractionClickAction.Preserve,
    })
  }

  private _handleSceneNodePointerDown(
    event: InputMouseEvent,
    hitNodeId: IDType
  ): EventResult {
    const selectedIds = this._getSelectedIds()
    const isSelected = selectedIds.includes(hitNodeId)
    const isMultiSelect = this._isMultiSelect(event)

    if (isSelected) {
      const ids = selectedIds.length > 0 ? selectedIds : [hitNodeId]
      return this._startPendingInteraction(event, {
        kind: SelectionOverlayInteractionKind.Move,
        intent: SelectionInteractionIntent.MoveSelection,
        ids,
        dragSelectionIds: ids,
        clickAction: isMultiSelect
          ? SelectionInteractionClickAction.Toggle
          : SelectionInteractionClickAction.Preserve,
        clickTargetId: hitNodeId,
      })
    }

    const dragIds = isMultiSelect
      ? this._appendUniqueId(selectedIds, hitNodeId)
      : [hitNodeId]

    return this._startPendingInteraction(event, {
      kind: SelectionOverlayInteractionKind.Move,
      intent: SelectionInteractionIntent.SelectAndMove,
      ids: dragIds,
      dragSelectionIds: dragIds,
      clickAction: isMultiSelect
        ? SelectionInteractionClickAction.Toggle
        : SelectionInteractionClickAction.Select,
      clickTargetId: hitNodeId,
    })
  }

  private _handlePointerMove(event: InputMouseEvent): EventResult {
    const state = this._interaction
    if (!state || !this._matchesPointer(state, event)) {
      return EventResult.IGNORED
    }

    if (this._isPendingInteraction(state)) {
      this._updatePendingPointer(state, event)
      if (this._hasExceededDragThreshold(state)) {
        this._activatePendingInteraction(state)
      }
      return EventResult.CONSUMED
    }

    state.latestWorld = this._getWorld(event)
    if (state.phase === SelectionOverlayInteractionPhase.Active) {
      this._flushInteraction(state)
    }
    return EventResult.CONSUMED
  }

  private _handlePointerUp(event: InputMouseEvent): EventResult {
    const state = this._interaction
    if (!state || !this._matchesPointer(state, event)) {
      return EventResult.IGNORED
    }

    if (this._isPendingInteraction(state)) {
      this._updatePendingPointer(state, event)
      const didDrag = this._hasExceededDragThreshold(state)
      const activeState = didDrag
        ? this._activatePendingInteraction(state)
        : null

      if (activeState) {
        activeState.latestWorld = this._getWorld(event)
        this._beginCommit(activeState)
      } else {
        if (!didDrag) {
          this._applyClickAction(state)
        }
        this._interaction = null
      }

      event.releasePointer()
      return EventResult.CONSUMED
    }

    state.latestWorld = this._getWorld(event)
    this._beginCommit(state)
    event.releasePointer()
    return EventResult.CONSUMED
  }

  private _handlePointerCancel(event: InputMouseEvent): EventResult {
    const state = this._interaction
    if (!state || !this._matchesPointer(state, event)) {
      return EventResult.IGNORED
    }

    if (this._isPendingInteraction(state)) {
      this._interaction = null
      event.releasePointer()
      return EventResult.CONSUMED
    }

    if (
      state.phase !== SelectionOverlayInteractionPhase.Committing &&
      state.phase !== SelectionOverlayInteractionPhase.Cancelling
    ) {
      state.phase = SelectionOverlayInteractionPhase.Cancelling
      void this._cancelInteraction(state)
    }

    event.releasePointer()
    return EventResult.CONSUMED
  }

  private _handleDoubleTap(event: InputMouseEvent): EventResult {
    const nodeId = event.hitResult?.nodeId
    if (!nodeId) {
      return EventResult.IGNORED
    }

    const handled =
      this._options.openSelectionScope?.({
        source: SelectionInteractionScopeSource.DoubleTap,
        nodeId,
        hitResult: event.hitResult,
        viewport: this._getViewport(event),
        world: this._getWorld(event),
      }) ?? false

    return handled ? EventResult.CONSUMED : EventResult.IGNORED
  }

  private _startPendingInteraction(
    event: InputMouseEvent,
    options: Omit<
      PendingSelectionPointerInteraction,
      | 'phase'
      | 'pointerId'
      | 'originWorld'
      | 'originViewport'
      | 'latestWorld'
      | 'latestViewport'
    >
  ): EventResult {
    const originWorld = this._getWorld(event)
    const originViewport = this._getViewport(event)
    this._interaction = {
      phase: SelectionOverlayInteractionPhase.Pending,
      pointerId: event.pointerId,
      originWorld,
      originViewport,
      latestWorld: originWorld,
      latestViewport: originViewport,
      ...options,
    }

    event.capturePointer()
    event.preventDefault()
    return EventResult.CONSUMED
  }

  private _activatePendingInteraction(
    state: PendingSelectionPointerInteraction
  ): ActiveSelectionPointerInteraction | null {
    if (
      state.kind === SelectionOverlayInteractionKind.Marquee ||
      state.kind === SelectionOverlayInteractionKind.Rotate
    ) {
      return null
    }

    if (state.intent === SelectionInteractionIntent.SelectAndMove) {
      this._selectIds(state.dragSelectionIds ?? state.ids)
    }

    const activeState: ActiveSelectionPointerInteraction = {
      kind: state.kind,
      ids: [...state.ids],
      pointerId: state.pointerId,
      direction: state.direction,
      originBounds: state.originBounds,
      originWorld: state.originWorld,
      latestWorld: state.latestWorld,
      phase: SelectionOverlayInteractionPhase.Beginning,
      hasBegun: false,
      beginFailed: false,
      hasFlushedUpdate: false,
      beginTask: Promise.resolve(),
    }

    this._interaction = activeState
    activeState.beginTask = this._beginInteraction(activeState)
    return activeState
  }

  private _beginCommit(state: ActiveSelectionPointerInteraction) {
    if (
      state.phase === SelectionOverlayInteractionPhase.Committing ||
      state.phase === SelectionOverlayInteractionPhase.Cancelling
    ) {
      return
    }

    state.phase = SelectionOverlayInteractionPhase.Committing
    void this._commitInteraction(state)
  }

  private async _beginInteraction(state: ActiveSelectionPointerInteraction) {
    try {
      await this._transformInteraction.beginTransform(
        state.ids,
        state.kind === SelectionOverlayInteractionKind.Resize
          ? SelectionOverlayInteractionLabel.ResizeSelection
          : SelectionOverlayInteractionLabel.MoveSelection
      )
      state.hasBegun = true

      if (
        this._interaction !== state ||
        state.phase !== SelectionOverlayInteractionPhase.Beginning
      ) {
        return
      }

      state.phase = SelectionOverlayInteractionPhase.Active
      this._flushInteraction(state)
    } catch {
      state.beginFailed = true
      if (this._interaction === state) {
        this._interaction = null
      }
    }
  }

  private async _commitInteraction(state: ActiveSelectionPointerInteraction) {
    await state.beginTask
    if (state.beginFailed) {
      return
    }

    try {
      this._flushInteraction(state)
      await this._transformInteraction.commitTransform()
    } finally {
      if (this._interaction === state) {
        this._interaction = null
      }
    }
  }

  private async _cancelInteraction(state: ActiveSelectionPointerInteraction) {
    await state.beginTask
    if (state.beginFailed) {
      return
    }

    try {
      await this._transformInteraction.cancelTransform()
    } finally {
      if (this._interaction === state) {
        this._interaction = null
      }
    }
  }

  private _flushInteraction(state: ActiveSelectionPointerInteraction) {
    if (!state.hasBegun || state.beginFailed) {
      return
    }

    if (state.kind === SelectionOverlayInteractionKind.Resize) {
      this._flushResize(state)
      return
    }

    this._flushMove(state)
  }

  private _flushMove(state: ActiveSelectionPointerInteraction) {
    const dx = state.latestWorld.x - state.originWorld.x
    const dy = state.latestWorld.y - state.originWorld.y
    if (dx === 0 && dy === 0 && !state.hasFlushedUpdate) {
      return
    }

    state.hasFlushedUpdate = true
    this._transformInteraction.moveBy(state.ids, [dx, dy])
  }

  private _flushResize(state: ActiveSelectionPointerInteraction) {
    if (
      state.direction !== 'se' ||
      !state.originBounds ||
      state.ids.length !== 1
    ) {
      return
    }

    const dx = state.latestWorld.x - state.originWorld.x
    const dy = state.latestWorld.y - state.originWorld.y
    if (dx === 0 && dy === 0 && !state.hasFlushedUpdate) {
      return
    }

    const width = Math.max(
      0,
      state.originBounds.maxX - state.originBounds.minX + dx
    )
    const height = Math.max(
      0,
      state.originBounds.maxY - state.originBounds.minY + dy
    )

    state.hasFlushedUpdate = true
    this._transformInteraction.resize(state.ids, width, height)
  }

  private _handleResizePointerDown(
    event: InputMouseEvent,
    overlayHit: Extract<
      SelectionOverlayHitData,
      { type: SelectionOverlayHitType.ResizeHandle }
    >
  ): EventResult {
    if (overlayHit.direction !== 'se' || overlayHit.ids.length !== 1) {
      event.preventDefault()
      return EventResult.CONSUMED
    }

    const originBounds = this._getResizableBounds(overlayHit.ids[0])
    if (!originBounds) {
      event.preventDefault()
      return EventResult.CONSUMED
    }

    return this._startPendingInteraction(event, {
      kind: SelectionOverlayInteractionKind.Resize,
      intent: SelectionInteractionIntent.ResizeSelection,
      ids: [overlayHit.ids[0]],
      direction: overlayHit.direction,
      originBounds,
      clickAction: SelectionInteractionClickAction.Preserve,
    })
  }

  private _getResizableBounds(id: IDType): OverlayBounds | null {
    const graph = this._options.getSceneGraph?.()
    if (!graph) {
      return null
    }

    const index = graph.getIndex(id)
    if (
      index === NULL_INDEX ||
      graph.type[index] !== NodeType.RECTANGLE ||
      (graph.lifecycle[index] & NodeLifecycle.Active) === 0 ||
      graph.visible[index] !== 1
    ) {
      return null
    }

    const ptr = index * 4
    const bounds = {
      minX: graph.aabb[ptr],
      minY: graph.aabb[ptr + 1],
      maxX: graph.aabb[ptr + 2],
      maxY: graph.aabb[ptr + 3],
    }

    if (
      !Number.isFinite(bounds.minX) ||
      !Number.isFinite(bounds.minY) ||
      !Number.isFinite(bounds.maxX) ||
      !Number.isFinite(bounds.maxY) ||
      bounds.minX >= bounds.maxX ||
      bounds.minY >= bounds.maxY
    ) {
      return null
    }

    return bounds
  }

  private _applyClickAction(state: PendingSelectionPointerInteraction) {
    switch (state.clickAction) {
      case SelectionInteractionClickAction.Select:
        if (state.clickTargetId) {
          this._selectIds([state.clickTargetId])
        }
        break
      case SelectionInteractionClickAction.Toggle:
        if (state.clickTargetId) {
          this._toggleId(state.clickTargetId)
        }
        break
      case SelectionInteractionClickAction.Clear:
        this._clearSelection()
        break
      case SelectionInteractionClickAction.Preserve:
      case SelectionInteractionClickAction.None:
        break
    }
  }

  private _updatePendingPointer(
    state: PendingSelectionPointerInteraction,
    event: InputMouseEvent
  ) {
    state.latestWorld = this._getWorld(event)
    state.latestViewport = this._getViewport(event)
  }

  private _hasExceededDragThreshold(state: PendingSelectionPointerInteraction) {
    const dx = state.latestViewport.x - state.originViewport.x
    const dy = state.latestViewport.y - state.originViewport.y
    const threshold =
      this._options.dragThresholdPx ?? DEFAULT_SELECTION_DRAG_THRESHOLD_PX
    return dx * dx + dy * dy >= threshold * threshold
  }

  private _matchesPointer(
    state: SelectionPointerInteraction,
    event: InputMouseEvent
  ) {
    return state.pointerId === undefined || state.pointerId === event.pointerId
  }

  private _isPendingInteraction(
    state: SelectionPointerInteraction
  ): state is PendingSelectionPointerInteraction {
    return state.phase === SelectionOverlayInteractionPhase.Pending
  }

  private _getSelectionOverlayHit(
    hitResult: HitResult | undefined
  ): SelectionOverlayHitData | null {
    if (
      hitResult?.kind !== 'render-layer' ||
      hitResult.layerId !== SELECTION_OVERLAY_LAYER_ID
    ) {
      return null
    }

    const data = hitResult.payload
    if (!this._isSelectionOverlayHitData(data)) {
      return null
    }
    return data
  }

  private _isSelectionOverlayHitData(
    data: unknown
  ): data is SelectionOverlayHitData {
    if (!data || typeof data !== 'object') {
      return false
    }

    const candidate = data as SelectionOverlayHitData
    return (
      (candidate.type === SelectionOverlayHitType.SelectionBounds ||
        candidate.type === SelectionOverlayHitType.ResizeHandle) &&
      Array.isArray(candidate.ids)
    )
  }

  private _getSelectedIds(): IDType[] {
    return [...(this._options.getSelectedIds?.() ?? [])]
  }

  private _selectIds(ids: readonly IDType[]) {
    this._options.selectIds?.(ids)
  }

  private _toggleId(id: IDType) {
    this._options.toggleId?.(id)
  }

  private _clearSelection() {
    this._options.clearSelection?.()
  }

  private _appendUniqueId(ids: readonly IDType[], id: IDType): IDType[] {
    return ids.includes(id) ? [...ids] : [...ids, id]
  }

  private _isMultiSelect(event: InputMouseEvent) {
    return event.ctrlKey || event.metaKey || event.shiftKey
  }

  private _isPrimaryPointer(event: InputMouseEvent) {
    return event.leftButton !== false
  }

  private _getWorld(event: InputMouseEvent): PointerPoint {
    return { x: event.world.x, y: event.world.y }
  }

  private _getViewport(event: InputMouseEvent): PointerPoint {
    const viewport = event.viewport ?? event.world
    return { x: viewport.x, y: viewport.y }
  }
}

export class SelectionOverlayInteractionTool extends SelectionInteractionTool {}
