export const SELECTION_INTERACTION_TOOL_ID = 'selection-interaction-tool'

export const SELECTION_OVERLAY_INTERACTION_TOOL_ID =
  SELECTION_INTERACTION_TOOL_ID

export const DEFAULT_SELECTION_DRAG_THRESHOLD_PX = 3

export enum InputPointerEventType {
  Down = 'pointerdown',
  Move = 'pointermove',
  Up = 'pointerup',
  Cancel = 'pointercancel',
  DoubleClick = 'dblclick',
}

export enum SelectionOverlayInteractionKind {
  Move = 'move',
  Resize = 'resize',
  Rotate = 'rotate',
  Marquee = 'marquee',
}

export enum SelectionOverlayInteractionPhase {
  Pending = 'pending',
  Beginning = 'beginning',
  Active = 'active',
  Committing = 'committing',
  Cancelling = 'cancelling',
}

export enum SelectionOverlayInteractionLabel {
  MoveSelection = 'move selection',
  ResizeSelection = 'resize selection',
  RotateSelection = 'rotate selection',
}

export enum SelectionInteractionIntent {
  MoveSelection = 'move-selection',
  SelectAndMove = 'select-and-move',
  ResizeSelection = 'resize-selection',
  RotateSelection = 'rotate-selection',
  MarqueeSelection = 'marquee-selection',
}

export enum SelectionInteractionClickAction {
  Preserve = 'preserve',
  Select = 'select',
  Toggle = 'toggle',
  Clear = 'clear',
  None = 'none',
}

export enum SelectionInteractionScopeSource {
  DoubleTap = 'double-tap',
}
