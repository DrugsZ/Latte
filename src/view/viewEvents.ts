export const enum ViewEventType {
  ViewFocusPageChange,
  ViewCameraChange,
  ViewElementChange,
}

export class ViewFocusPageChangeEvent {
  public readonly type: ViewEventType.ViewFocusPageChange
  constructor(public readonly newFocusPageId: string) {}
}

export class ViewCameraUpdateEvent {
  public readonly type: ViewEventType.ViewCameraChange
}

export class ViewElementChangeEvent {
  public readonly type: ViewEventType.ViewElementChange
}

export type ViewEvent =
  | ViewFocusPageChangeEvent
  | ViewCameraUpdateEvent
  | ViewElementChangeEvent
