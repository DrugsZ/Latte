import type { Camera } from 'Latte/core/services/camera/cameraService'
import type { DisplayObject } from 'Latte/core/elements/displayObject'
import type { MouseControllerTarget } from 'Latte/core/selection/activeSelection'
import type { OperateMode } from 'Latte/core/cursor/cursor'
import type { ICursorState } from 'Latte/core/cursor/cursorState'

export enum ViewEventType {
  ViewFocusPageChange,
  ViewCameraChange,
  ViewElementChange,
  ViewActiveSelectionChange,
  ViewHoverObjectChange,
  ViewHoverControllerKeyChange,
  ViewCursorOperateModeChange,
  ViewCursorMove,
  ViewCursorStateChange,
}

export enum ViewElementChangeType {
  ViewElementAdded,
  ViewElementRemoved,
  ViewElementChanged,
}

export enum ViewActiveSelectionChangeType {
  ViewActiveSelectionElementAdded,
  ViewActiveSelectionElementRemoved,
}

export class ViewFocusPageChangeEvent {
  public readonly type = ViewEventType.ViewFocusPageChange
  constructor(public readonly newFocusPageId: string) {}
}

export class ViewCameraUpdateEvent {
  public readonly type = ViewEventType.ViewCameraChange
  constructor(public readonly camera: Camera) {}
}

export class ViewElementChangeEvent {
  public readonly type = ViewEventType.ViewElementChange
  constructor(
    public readonly objects: DisplayObject[],
    public readonly changeType: ViewElementChangeType
  ) {}
}

export class ViewActiveSelectionChangeEvent {
  public readonly type = ViewEventType.ViewActiveSelectionChange
  constructor(
    public readonly objects: DisplayObject[],
    public readonly changeType: ViewActiveSelectionChangeType
  ) {}
}

export class ViewHoverObjectChangeEvent {
  public readonly type = ViewEventType.ViewHoverObjectChange
  constructor(public readonly object: DisplayObject | null) {}
}

export class ViewHoverControllerKeyChangeEvent {
  public readonly type = ViewEventType.ViewHoverControllerKeyChange
  constructor(public readonly controllerKey: MouseControllerTarget) {}
}

export class ViewCursorOperateModeChange {
  public readonly type = ViewEventType.ViewCursorOperateModeChange
  constructor(public readonly mode: OperateMode) {}
}

export class ViewCursorMoveEvent {
  public readonly type = ViewEventType.ViewCursorMove
  constructor(public readonly selectMode: boolean) {}
}

export class ViewCursorStateChangeEvent {
  public readonly type = ViewEventType.ViewCursorStateChange
  constructor(public readonly state: ICursorState) {}
}

export type ViewEvent =
  | ViewFocusPageChangeEvent
  | ViewCameraUpdateEvent
  | ViewElementChangeEvent
  | ViewHoverObjectChangeEvent
  | ViewHoverControllerKeyChangeEvent
  | ViewCursorOperateModeChange
  | ViewActiveSelectionChangeEvent
  | ViewCursorMoveEvent
  | ViewCursorStateChangeEvent
