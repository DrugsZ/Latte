import type { Camera } from 'Latte/core/cameraService'
import type { ViewMouseModeType } from 'Latte/core/viewMouseMode'
import type { DisplayObject } from 'Latte/core/displayObject'

export enum ViewEventType {
  ViewFocusPageChange,
  ViewCameraChange,
  ViewElementChange,
  ViewActiveSelectionChange,
  ViewMouseModelChange,
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
    public readonly elements: DisplayObject[],
    public readonly changeType: ViewElementChangeType
  ) {}
}

export class ViewActiveSelectionChangeEvent {
  public readonly type = ViewEventType.ViewActiveSelectionChange
  constructor(
    public readonly elements: DisplayObject[],
    public readonly changeType: ViewActiveSelectionChangeType
  ) {}
}

export class ViewMouseModeChangeEvent {
  public readonly type = ViewEventType.ViewMouseModelChange
  constructor(public readonly viewMouseMode: ViewMouseModeType) {}
}

export type ViewEvent =
  | ViewFocusPageChangeEvent
  | ViewCameraUpdateEvent
  | ViewElementChangeEvent
  | ViewMouseModeChangeEvent
  | ViewActiveSelectionChangeEvent
