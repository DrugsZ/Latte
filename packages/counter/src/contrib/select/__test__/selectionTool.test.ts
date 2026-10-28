import { SceneGraph } from '@latte-js/espresso'
import { EventResult } from '@latte-js/syrup'
import { describe, expect, it, vi } from 'vitest'

import { SelectionService } from '../../../services/selection/selectionService'
import { SelectionTool } from '../selectionTool'

const pointerDown = (hitResult: unknown, modifiers = {}) => ({
  browserEvent: { type: 'pointerdown' },
  world: { x: 10, y: 20 },
  capturePointer: vi.fn(),
  releasePointer: vi.fn(),
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

  it('moves a selected node through a transform session', async () => {
    const selection = new SelectionService(new SceneGraph())
    const transform = {
      beginTransform: vi.fn().mockResolvedValue(undefined),
      moveBy: vi.fn(),
      commitTransform: vi.fn().mockResolvedValue(undefined),
      cancelTransform: vi.fn().mockResolvedValue(undefined),
    }
    const tool = new SelectionTool(selection, transform)
    const down = pointerDown({ nodeId: 'test:rect' })

    expect((tool as any)._handlePointerDown(down)).toBe(EventResult.CONSUMED)
    await vi.waitFor(() => expect(transform.beginTransform).toHaveBeenCalled())

    const move = {
      ...down,
      browserEvent: { type: 'pointermove' },
      world: { x: 25, y: 35 },
    }
    expect((tool as any)._handlePointerMove(move)).toBe(EventResult.CONSUMED)
    expect(transform.moveBy).toHaveBeenCalledWith(['test:rect'], [15, 15])

    const up = {
      ...move,
      browserEvent: { type: 'pointerup' },
    }
    ;(tool as any)._handlePointerEnd(up, false)
    await vi.waitFor(() => expect(transform.commitTransform).toHaveBeenCalled())
    expect(down.capturePointer).toHaveBeenCalled()
    expect(up.releasePointer).toHaveBeenCalled()
  })
})
