import { EventResult } from '@latte-js/syrup'
import { describe, expect, it, vi } from 'vitest'

import {
  SELECTION_OVERLAY_LAYER_ID,
  SelectionOverlayHitType,
} from '../../overlay/selectionOverlayLayer'
import { SelectionInteractionTool } from '../selectionOverlayInteractionTool'
import {
  InputPointerEventType,
  SelectionInteractionScopeSource,
  SelectionOverlayInteractionLabel,
} from '../selectionOverlayInteractionTypes'

import type { IDType } from '@latte-js/bean'

const waitForMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const createDeferred = () => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const createTransformInteraction = () => ({
  isActive: false,
  beginTransform: vi.fn(async () => {}),
  moveBy: vi.fn(),
  resize: vi.fn(),
  resizeByHandle: vi.fn(),
  transformAround: vi.fn(),
  commitTransform: vi.fn(async () => {}),
  cancelTransform: vi.fn(async () => {}),
})

const overlayHit = (
  payload: Record<string, unknown>,
  targetId: string = SelectionOverlayHitType.SelectionBounds
) => ({
  kind: 'render-layer',
  layerId: SELECTION_OVERLAY_LAYER_ID,
  targetId,
  payload,
})

const pointerEvent = (
  type: InputPointerEventType,
  options: {
    hitResult?: unknown
    world?: { x: number; y: number }
    viewport?: { x: number; y: number }
    pointerId?: number
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
  } = {}
) => {
  const world = options.world ?? { x: 10, y: 10 }
  return {
    browserEvent: { type },
    hitResult: options.hitResult,
    world,
    viewport: options.viewport ?? world,
    pointerId: options.pointerId ?? 1,
    leftButton: true,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false,
    capturePointer: vi.fn(),
    releasePointer: vi.fn(),
    preventDefault: vi.fn(),
  }
}

describe('SelectionInteractionTool', () => {
  it('clicks an unselected scene node without starting transform', () => {
    const transform = createTransformInteraction()
    const selectIds = vi.fn()
    const tool = new SelectionInteractionTool(transform, {
      getSelectedIds: () => [],
      selectIds,
    })
    const down = pointerEvent(InputPointerEventType.Down, {
      hitResult: { nodeId: 'test:rect' },
    })
    const up = pointerEvent(InputPointerEventType.Up, {
      hitResult: { nodeId: 'test:rect' },
    })

    expect(tool.onEvent(down as any)).toBe(EventResult.CONSUMED)
    expect(transform.beginTransform).not.toHaveBeenCalled()
    expect(down.capturePointer).toHaveBeenCalled()

    expect(tool.onEvent(up as any)).toBe(EventResult.CONSUMED)

    expect(selectIds).toHaveBeenCalledWith(['test:rect'])
    expect(transform.beginTransform).not.toHaveBeenCalled()
    expect(transform.commitTransform).not.toHaveBeenCalled()
    expect(up.releasePointer).toHaveBeenCalled()
  })

  it('selects and moves an unselected scene node after drag threshold', async () => {
    const transform = createTransformInteraction()
    const selectIds = vi.fn()
    const tool = new SelectionInteractionTool(transform, {
      getSelectedIds: () => [],
      selectIds,
    })

    tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        hitResult: { nodeId: 'test:rect' },
        world: { x: 10, y: 10 },
      }) as any
    )
    expect(transform.beginTransform).not.toHaveBeenCalled()

    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 18, y: 21 },
      }) as any
    )
    await waitForMicrotasks()

    expect(selectIds).toHaveBeenCalledWith(['test:rect'])
    expect(transform.beginTransform).toHaveBeenCalledWith(
      ['test:rect'],
      SelectionOverlayInteractionLabel.MoveSelection
    )
    expect(transform.moveBy).toHaveBeenLastCalledWith(['test:rect'], [8, 11])
  })

  it('keeps selection when clicking an already selected scene node', () => {
    const transform = createTransformInteraction()
    const selectIds = vi.fn()
    const toggleId = vi.fn()
    const tool = new SelectionInteractionTool(transform, {
      getSelectedIds: () => ['test:rect'],
      selectIds,
      toggleId,
    })

    tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        hitResult: { nodeId: 'test:rect' },
      }) as any
    )
    tool.onEvent(pointerEvent(InputPointerEventType.Up) as any)

    expect(selectIds).not.toHaveBeenCalled()
    expect(toggleId).not.toHaveBeenCalled()
    expect(transform.beginTransform).not.toHaveBeenCalled()
  })

  it('toggles selected scene node on modifier click', () => {
    const transform = createTransformInteraction()
    const toggleId = vi.fn()
    const tool = new SelectionInteractionTool(transform, {
      getSelectedIds: () => ['test:rect', 'test:other'],
      toggleId,
    })

    tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        hitResult: { nodeId: 'test:rect' },
        shiftKey: true,
      }) as any
    )
    tool.onEvent(
      pointerEvent(InputPointerEventType.Up, {
        shiftKey: true,
      }) as any
    )

    expect(toggleId).toHaveBeenCalledWith('test:rect')
    expect(transform.beginTransform).not.toHaveBeenCalled()
  })

  it('moves current selection when dragging a selected scene node', async () => {
    const transform = createTransformInteraction()
    const tool = new SelectionInteractionTool(transform, {
      getSelectedIds: () => ['test:rect', 'test:other'],
    })

    tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        hitResult: { nodeId: 'test:rect' },
        world: { x: 10, y: 10 },
      }) as any
    )
    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 14, y: 18 },
      }) as any
    )
    await waitForMicrotasks()

    expect(transform.beginTransform).toHaveBeenCalledWith(
      ['test:rect', 'test:other'],
      SelectionOverlayInteractionLabel.MoveSelection
    )
    expect(transform.moveBy).toHaveBeenLastCalledWith(
      ['test:rect', 'test:other'],
      [4, 8]
    )
  })

  it('does not move selection bounds until drag threshold is exceeded', async () => {
    const transform = createTransformInteraction()
    const tool = new SelectionInteractionTool(transform)
    const down = pointerEvent(InputPointerEventType.Down, {
      hitResult: overlayHit({
        type: SelectionOverlayHitType.SelectionBounds,
        ids: ['test:rect'],
      }),
      world: { x: 10, y: 10 },
    })

    expect(tool.onEvent(down as any)).toBe(EventResult.CONSUMED)
    expect(transform.beginTransform).not.toHaveBeenCalled()

    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 11, y: 11 },
      }) as any
    )
    expect(transform.beginTransform).not.toHaveBeenCalled()

    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 16, y: 20 },
      }) as any
    )
    await waitForMicrotasks()

    expect(transform.beginTransform).toHaveBeenCalledWith(
      ['test:rect'],
      SelectionOverlayInteractionLabel.MoveSelection
    )
    expect(transform.moveBy).toHaveBeenLastCalledWith(['test:rect'], [6, 10])
  })

  it('keeps selection when selection bounds are clicked without dragging', () => {
    const transform = createTransformInteraction()
    const selectIds = vi.fn()
    const clearSelection = vi.fn()
    const tool = new SelectionInteractionTool(transform, {
      selectIds,
      clearSelection,
    })

    tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        hitResult: overlayHit({
          type: SelectionOverlayHitType.SelectionBounds,
          ids: ['test:rect'],
        }),
      }) as any
    )
    tool.onEvent(pointerEvent(InputPointerEventType.Up) as any)

    expect(selectIds).not.toHaveBeenCalled()
    expect(clearSelection).not.toHaveBeenCalled()
    expect(transform.beginTransform).not.toHaveBeenCalled()
  })

  it('sends total deltas instead of incremental deltas while moving', async () => {
    const transform = createTransformInteraction()
    const tool = new SelectionInteractionTool(transform)

    tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        hitResult: overlayHit({
          type: SelectionOverlayHitType.SelectionBounds,
          ids: ['test:rect'],
        }),
        world: { x: 10, y: 10 },
      }) as any
    )
    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 12, y: 15 },
      }) as any
    )
    await waitForMicrotasks()
    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 14, y: 18 },
      }) as any
    )

    expect(transform.moveBy).toHaveBeenLastCalledWith(['test:rect'], [4, 8])
  })

  it('commits move on pointer up after flushing the final delta', async () => {
    const transform = createTransformInteraction()
    const tool = new SelectionInteractionTool(transform)

    tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        hitResult: overlayHit({
          type: SelectionOverlayHitType.SelectionBounds,
          ids: ['test:rect'],
        }),
        world: { x: 10, y: 10 },
      }) as any
    )
    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 14, y: 18 },
      }) as any
    )
    await waitForMicrotasks()

    const up = pointerEvent(InputPointerEventType.Up, {
      world: { x: 20, y: 25 },
    })
    const result = tool.onEvent(up as any)
    await waitForMicrotasks()

    expect(result).toBe(EventResult.CONSUMED)
    expect(transform.moveBy).toHaveBeenLastCalledWith(['test:rect'], [10, 15])
    expect(transform.commitTransform).toHaveBeenCalled()
    expect(up.releasePointer).toHaveBeenCalled()
  })

  it('records pointer moves before begin resolves and flushes the latest total delta', async () => {
    const begin = createDeferred()
    const transform = createTransformInteraction()
    transform.beginTransform.mockReturnValue(begin.promise)
    const tool = new SelectionInteractionTool(transform)

    tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        hitResult: overlayHit({
          type: SelectionOverlayHitType.SelectionBounds,
          ids: ['test:rect'],
        }),
        world: { x: 10, y: 10 },
      }) as any
    )
    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 18, y: 21 },
      }) as any
    )

    expect(transform.moveBy).not.toHaveBeenCalled()

    begin.resolve()
    await waitForMicrotasks()

    expect(transform.moveBy).toHaveBeenCalledWith(['test:rect'], [8, 11])
  })

  it('clears selection on empty click', () => {
    const transform = createTransformInteraction()
    const clearSelection = vi.fn()
    const tool = new SelectionInteractionTool(transform, {
      clearSelection,
    })

    tool.onEvent(pointerEvent(InputPointerEventType.Down) as any)
    tool.onEvent(pointerEvent(InputPointerEventType.Up) as any)

    expect(clearSelection).toHaveBeenCalled()
    expect(transform.beginTransform).not.toHaveBeenCalled()
  })

  it('reserves empty drag for marquee without clearing selection for now', () => {
    const transform = createTransformInteraction()
    const clearSelection = vi.fn()
    const tool = new SelectionInteractionTool(transform, {
      clearSelection,
    })

    tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        world: { x: 10, y: 10 },
      }) as any
    )
    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 40, y: 50 },
      }) as any
    )
    tool.onEvent(
      pointerEvent(InputPointerEventType.Up, {
        world: { x: 40, y: 50 },
      }) as any
    )

    expect(clearSelection).not.toHaveBeenCalled()
    expect(transform.beginTransform).not.toHaveBeenCalled()
  })

  it('starts resize interactions from any resize handle', async () => {
    const transform = createTransformInteraction()
    const tool = new SelectionInteractionTool(transform)

    const result = tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        hitResult: overlayHit(
          {
            type: SelectionOverlayHitType.ResizeHandle,
            ids: ['test:rect'],
            direction: 'nw',
          },
          'resize-nw'
        ),
      }) as any
    )

    expect(result).toBe(EventResult.CONSUMED)
    expect(transform.beginTransform).not.toHaveBeenCalled()

    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 0, y: 0 },
        viewport: { x: 20, y: 20 },
      }) as any
    )
    await waitForMicrotasks()

    expect(transform.beginTransform).toHaveBeenCalledWith(
      ['test:rect'],
      SelectionOverlayInteractionLabel.ResizeSelection
    )
    expect(transform.resizeByHandle).toHaveBeenLastCalledWith(
      ['test:rect'],
      'nw',
      [0, 0]
    )
  })

  it('resizes from the south-east handle after drag threshold', async () => {
    const transform = createTransformInteraction()
    const tool = new SelectionInteractionTool(transform)
    const down = pointerEvent(InputPointerEventType.Down, {
      hitResult: overlayHit(
        {
          type: SelectionOverlayHitType.ResizeHandle,
          ids: ['test:rect'],
          direction: 'se',
        },
        'resize-se'
      ),
      world: { x: 110, y: 70 },
    })

    const result = tool.onEvent(down as any)
    expect(result).toBe(EventResult.CONSUMED)
    expect(transform.beginTransform).not.toHaveBeenCalled()

    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 111, y: 71 },
      }) as any
    )
    expect(transform.beginTransform).not.toHaveBeenCalled()

    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 130, y: 95 },
      }) as any
    )
    await waitForMicrotasks()

    expect(transform.beginTransform).toHaveBeenCalledWith(
      ['test:rect'],
      SelectionOverlayInteractionLabel.ResizeSelection
    )
    expect(transform.resizeByHandle).toHaveBeenLastCalledWith(
      ['test:rect'],
      'se',
      [130, 95]
    )

    const up = pointerEvent(InputPointerEventType.Up, {
      world: { x: 140, y: 100 },
    })
    tool.onEvent(up as any)
    await waitForMicrotasks()

    expect(transform.resizeByHandle).toHaveBeenLastCalledWith(
      ['test:rect'],
      'se',
      [140, 100]
    )
    expect(transform.commitTransform).toHaveBeenCalled()
    expect(up.releasePointer).toHaveBeenCalled()
  })

  it('does not cancel transform when pointer is cancelled before drag threshold', async () => {
    const transform = createTransformInteraction()
    const tool = new SelectionInteractionTool(transform)

    tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        hitResult: overlayHit({
          type: SelectionOverlayHitType.SelectionBounds,
          ids: ['test:rect'],
        }),
      }) as any
    )

    const cancel = pointerEvent(InputPointerEventType.Cancel)
    expect(tool.onEvent(cancel as any)).toBe(EventResult.CONSUMED)
    await waitForMicrotasks()

    expect(transform.cancelTransform).not.toHaveBeenCalled()
    expect(cancel.releasePointer).toHaveBeenCalled()
  })

  it('cancels active move on pointer cancel', async () => {
    const transform = createTransformInteraction()
    const tool = new SelectionInteractionTool(transform)

    tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        hitResult: overlayHit({
          type: SelectionOverlayHitType.SelectionBounds,
          ids: ['test:rect'],
        }),
        world: { x: 10, y: 10 },
      }) as any
    )
    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 20, y: 20 },
      }) as any
    )
    await waitForMicrotasks()

    const cancel = pointerEvent(InputPointerEventType.Cancel)
    const result = tool.onEvent(cancel as any)
    await waitForMicrotasks()

    expect(result).toBe(EventResult.CONSUMED)
    expect(transform.cancelTransform).toHaveBeenCalled()
    expect(cancel.releasePointer).toHaveBeenCalled()
  })

  it('ignores pointer id mismatches while an interaction is pending', () => {
    const transform = createTransformInteraction()
    const tool = new SelectionInteractionTool(transform)

    tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        hitResult: overlayHit({
          type: SelectionOverlayHitType.SelectionBounds,
          ids: ['test:rect'],
        }),
        pointerId: 1,
      }) as any
    )

    const moveResult = tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 30, y: 30 },
        pointerId: 2,
      }) as any
    )
    const upResult = tool.onEvent(
      pointerEvent(InputPointerEventType.Up, {
        pointerId: 2,
      }) as any
    )

    expect(moveResult).toBe(EventResult.IGNORED)
    expect(upResult).toBe(EventResult.IGNORED)
    expect(transform.beginTransform).not.toHaveBeenCalled()
  })

  it('clears the interaction when begin transform fails', async () => {
    const begin = createDeferred()
    const transform = createTransformInteraction()
    transform.beginTransform.mockReturnValue(begin.promise)
    const tool = new SelectionInteractionTool(transform)

    tool.onEvent(
      pointerEvent(InputPointerEventType.Down, {
        hitResult: overlayHit({
          type: SelectionOverlayHitType.SelectionBounds,
          ids: ['test:rect' as IDType],
        }),
        world: { x: 10, y: 10 },
      }) as any
    )
    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 20, y: 20 },
      }) as any
    )

    begin.reject(new Error('nope'))
    await waitForMicrotasks()

    tool.onEvent(
      pointerEvent(InputPointerEventType.Move, {
        world: { x: 30, y: 30 },
      }) as any
    )
    tool.onEvent(
      pointerEvent(InputPointerEventType.Up, {
        world: { x: 30, y: 30 },
      }) as any
    )
    await waitForMicrotasks()

    expect(transform.moveBy).not.toHaveBeenCalled()
    expect(transform.commitTransform).not.toHaveBeenCalled()
  })

  it('exposes a double-tap scope hook for future group/frame drill-down', () => {
    const transform = createTransformInteraction()
    const openSelectionScope = vi.fn(() => true)
    const tool = new SelectionInteractionTool(transform, {
      openSelectionScope,
    })

    const event = pointerEvent(InputPointerEventType.DoubleClick, {
      hitResult: { nodeId: 'test:frame' },
      world: { x: 30, y: 40 },
      viewport: { x: 3, y: 4 },
    })

    expect(tool.onEvent(event as any)).toBe(EventResult.CONSUMED)
    expect(openSelectionScope).toHaveBeenCalledWith({
      source: SelectionInteractionScopeSource.DoubleTap,
      nodeId: 'test:frame',
      hitResult: { nodeId: 'test:frame' },
      viewport: { x: 3, y: 4 },
      world: { x: 30, y: 40 },
    })
  })
})
