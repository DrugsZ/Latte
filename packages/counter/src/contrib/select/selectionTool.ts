import { EventResult, InputMouseEvent } from '@latte-js/syrup'

import type { IInputMouseHandler, InputWheelEvent } from '@latte-js/syrup'
import type { SelectionService } from '../../services/selection/selectionService'

export class SelectionTool implements IInputMouseHandler {
  public readonly id = 'selection-tool'
  public priority = 100
  constructor(private readonly _selectionService: SelectionService) {}

  onEvent(e: InputMouseEvent | InputWheelEvent): EventResult {
    if (
      e.browserEvent?.type === 'pointerdown' &&
      e instanceof InputMouseEvent
    ) {
      return this._handlePointerDown(e)
    }
    return EventResult.IGNORED
  }

  private _handlePointerDown(e: InputMouseEvent): EventResult {
    const isMultiSelect = e.ctrlKey || e.metaKey || e.shiftKey
    const hitNodeIndex = e.hitResult?.nodeIndex

    if (hitNodeIndex !== undefined) {
      if (isMultiSelect) {
        this._selectionService.toggle(hitNodeIndex)
      } else {
        this._selectionService.select([hitNodeIndex])
      }
      return EventResult.CONSUMED
    } else {
      if (!isMultiSelect) {
        this._selectionService.clear()
      }
    }

    return EventResult.IGNORED
  }
}
