import { SceneGraph } from '@latte-js/espresso'
import { EventResult } from '@latte-js/syrup'
import { describe, expect, it } from 'vitest'

import { SelectionService } from '../../../services/selection/selectionService'
import { SelectionTool } from '../selectionTool'

const pointerDown = (hitResult: unknown, modifiers = {}) => ({
  browserEvent: { type: 'pointerdown' },
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  hitResult,
  ...modifiers,
})

describe('SelectionTool', () => {
  it('selects scene node hits', () => {
    const selection = new SelectionService(new SceneGraph())
    const tool = new SelectionTool(selection)

    const result = (tool as any)._handlePointerDown(
      pointerDown({ nodeId: 'test:rect' })
    )

    expect(result).toBe(EventResult.CONSUMED)
    expect(selection.ids).toEqual(['test:rect'])
  })

  it('ignores render layer hits without clearing selection', () => {
    const selection = new SelectionService(new SceneGraph())
    selection.select(['test:rect'])
    const tool = new SelectionTool(selection)

    const result = (tool as any)._handlePointerDown(
      pointerDown({
        kind: 'render-layer',
        layerId: 'latte.selection-overlay',
        targetId: 'resize-nw',
      })
    )

    expect(result).toBe(EventResult.IGNORED)
    expect(selection.ids).toEqual(['test:rect'])
  })
})
