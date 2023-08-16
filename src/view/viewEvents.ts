import type { Camera } from 'Latte/core/cameraService'
import type { ViewMouseModeType } from 'Latte/core/viewMouseMode'

export enum ViewEventType {
  ViewFocusPageChange,
  ViewCameraChange,
  ViewElementChange,
  ViewMouseModelChange,
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
