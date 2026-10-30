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

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>(done => {
    resolve = done
  })
  return { promise, resolve }
}

const transformMock = () => ({
  beginTransform: vi.fn().mockResolvedValue(undefined),
  moveBy: vi.fn(),
  commitTransform: vi.fn().mockResolvedValue(undefined),
  cancelTransform: vi.fn().mockResolvedValue(undefined),
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

  it('commits the final release position even when worker begin is still pending', async () => {
    const selection = new SelectionService(new SceneGraph())
    const begin = deferred()
    const transform = transformMock()
    transform.beginTransform.mockReturnValue(begin.promise)
    const tool = new SelectionTool(selection, transform)
    const down = pointerDown({ nodeId: 'test:rect' })
    ;(tool as any)._handlePointerDown(down)
    ;(tool as any)._handlePointerMove({ ...down, world: { x: 20, y: 30 } })
    ;(tool as any)._handlePointerEnd(
      { ...down, world: { x: 40, y: 70 } },
      false
    )

    begin.resolve()
    await vi.waitFor(() =>
      expect(transform.commitTransform).toHaveBeenCalledTimes(1)
    )

    expect(transform.moveBy).toHaveBeenLastCalledWith(['test:rect'], [30, 50])
    expect(transform.cancelTransform).not.toHaveBeenCalled()
  })

  it('rolls back a cancelled gesture without sending the final pointer coordinates', async () => {
    const selection = new SelectionService(new SceneGraph())
    const begin = deferred()
    const transform = transformMock()
    transform.beginTransform.mockReturnValue(begin.promise)
    const tool = new SelectionTool(selection, transform)
    const down = pointerDown({ nodeId: 'test:rect' })
    ;(tool as any)._handlePointerDown(down)
    ;(tool as any)._handlePointerEnd(
      { ...down, world: { x: 100, y: 200 } },
      true
    )

    begin.resolve()
    await vi.waitFor(() =>
      expect(transform.cancelTransform).toHaveBeenCalledTimes(1)
    )

    expect(transform.moveBy).not.toHaveBeenCalled()
    expect(transform.commitTransform).not.toHaveBeenCalled()
  })

  it('waits for the preceding commit before starting the next drag', async () => {
    const selection = new SelectionService(new SceneGraph())
    const commit = deferred()
    const transform = transformMock()
    transform.commitTransform.mockReturnValueOnce(commit.promise)
    const tool = new SelectionTool(selection, transform)
    const down = pointerDown({ nodeId: 'test:rect' })
    ;(tool as any)._handlePointerDown(down)
    ;(tool as any)._handlePointerEnd(
      { ...down, world: { x: 20, y: 30 } },
      false
    )
    await vi.waitFor(() =>
      expect(transform.commitTransform).toHaveBeenCalledTimes(1)
    )
    ;(tool as any)._handlePointerDown(down)
    ;(tool as any)._handlePointerEnd(
      { ...down, world: { x: 50, y: 80 } },
      false
    )
    await Promise.resolve()
    expect(transform.beginTransform).toHaveBeenCalledTimes(1)

    commit.resolve()
    await vi.waitFor(() =>
      expect(transform.commitTransform).toHaveBeenCalledTimes(2)
    )
    expect(transform.beginTransform).toHaveBeenCalledTimes(2)
    expect(transform.moveBy).toHaveBeenLastCalledWith(['test:rect'], [40, 60])
  })

  it('ignores movement and release from a different pointer', async () => {
    const selection = new SelectionService(new SceneGraph())
    const transform = transformMock()
    const tool = new SelectionTool(selection, transform)
    const down = pointerDown({ nodeId: 'test:rect' }, { pointerId: 1 })
    ;(tool as any)._handlePointerDown(down)
    await vi.waitFor(() => expect(transform.moveBy).toHaveBeenCalled())
    transform.moveBy.mockClear()

    expect((tool as any)._handlePointerMove({ ...down, pointerId: 2 })).toBe(
      EventResult.IGNORED
    )
    ;(tool as any)._handlePointerEnd({ ...down, pointerId: 2 }, false)
    expect(transform.commitTransform).not.toHaveBeenCalled()
    expect(transform.moveBy).not.toHaveBeenCalled()
    ;(tool as any)._handlePointerEnd(down, true)
    await vi.waitFor(() =>
      expect(transform.cancelTransform).toHaveBeenCalledTimes(1)
    )
  })

  it('does not select or start a transform on right click', () => {
    const selection = new SelectionService(new SceneGraph())
    const transform = transformMock()
    const tool = new SelectionTool(selection, transform)
    expect(
      (tool as any)._handlePointerDown(
        pointerDown({ nodeId: 'test:rect' }, { button: 2 })
      )
    ).toBe(EventResult.IGNORED)
    expect(selection.isEmpty).toBe(true)
    expect(transform.beginTransform).not.toHaveBeenCalled()
  })
})
