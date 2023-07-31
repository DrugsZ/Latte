import type { Camera } from 'Latte/core/cameraService'

export enum ViewEventType {
  ViewFocusPageChange,
  ViewCameraChange,
  ViewElementChange,
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

export type ViewEvent =
  | ViewFocusPageChangeEvent
  | ViewCameraUpdateEvent
  | ViewElementChangeEvent
