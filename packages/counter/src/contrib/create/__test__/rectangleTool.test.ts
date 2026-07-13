import { SceneGraph } from '@latte-js/espresso'
import { describe, expect, it, vi } from 'vitest'

import {
  CreationPreviewStore,
  CreationPreviewType,
} from '../../../overlay/creationPreviewState'
import { SelectionService } from '../../../services/selection/selectionService'
import { RectangleTool } from '../rectangleTool'

const waitForMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const createNodeService = () => ({
  createRectangle: vi.fn(async () => 'test:created'),
})

const pointerEvent = (world: { x: number; y: number }, pointerId = 1) =>
  ({
    world,
    pointerId,
    capturePointer: vi.fn(),
    releasePointer: vi.fn(),
    preventDefault: vi.fn(),
  }) as any

describe('RectangleTool', () => {
  it('updates preview while dragging and creates a normalized rectangle on pointer up', async () => {
    const nodeService = createNodeService()
    const selection = new SelectionService(new SceneGraph())
    const preview = new CreationPreviewStore()
    const tool = new RectangleTool({
      nodeService: nodeService as any,
      selectionService: selection,
      previewStore: preview,
      getParentId: () => 'test:page',
      createId: () => 'test:rect',
    })
    const down = pointerEvent({ x: 40, y: 50 })

    tool.onPointerDown(down)
    tool.onPointerMove(pointerEvent({ x: 10, y: 20 }))

    expect(down.capturePointer).toHaveBeenCalled()
    expect(preview.state).toEqual({
      type: CreationPreviewType.Rectangle,
      bounds: {
        minX: 10,
        minY: 20,
        maxX: 40,
        maxY: 50,
      },
    })
    expect(nodeService.createRectangle).not.toHaveBeenCalled()

    const up = pointerEvent({ x: 10, y: 20 })
    tool.onPointerUp(up)
    await waitForMicrotasks()

    expect(up.releasePointer).toHaveBeenCalled()
    expect(nodeService.createRectangle).toHaveBeenCalledWith('test:page', {
      id: 'test:rect',
      x: 10,
      y: 20,
      width: 30,
      height: 30,
    })
    expect(selection.ids).toEqual(['test:created'])
    expect(preview.state).toBeNull()
  })

  it('does not create rectangles below the minimum size', async () => {
    const nodeService = createNodeService()
    const selection = new SelectionService(new SceneGraph())
    const preview = new CreationPreviewStore()
    const tool = new RectangleTool({
      nodeService: nodeService as any,
      selectionService: selection,
      previewStore: preview,
      getParentId: () => 'test:page',
    })

    tool.onPointerDown(pointerEvent({ x: 10, y: 10 }))
    tool.onPointerUp(pointerEvent({ x: 10.5, y: 20 }))
    await waitForMicrotasks()

    expect(nodeService.createRectangle).not.toHaveBeenCalled()
    expect(selection.ids).toEqual([])
    expect(preview.state).toBeNull()
  })

  it('clears preview on pointer cancel without creating a node', () => {
    const nodeService = createNodeService()
    const preview = new CreationPreviewStore()
    const tool = new RectangleTool({
      nodeService: nodeService as any,
      selectionService: new SelectionService(new SceneGraph()),
      previewStore: preview,
      getParentId: () => 'test:page',
    })

    tool.onPointerDown(pointerEvent({ x: 10, y: 10 }))
    tool.onPointerMove(pointerEvent({ x: 30, y: 40 }))
    tool.onPointerCancel(pointerEvent({ x: 30, y: 40 }))

    expect(preview.state).toBeNull()
    expect(nodeService.createRectangle).not.toHaveBeenCalled()
  })

  it('ignores creation when no parent is active', () => {
    const nodeService = createNodeService()
    const event = pointerEvent({ x: 10, y: 10 })
    const tool = new RectangleTool({
      nodeService: nodeService as any,
      selectionService: new SelectionService(new SceneGraph()),
      previewStore: new CreationPreviewStore(),
      getParentId: () => null,
    })

    tool.onPointerDown(event)

    expect(event.capturePointer).not.toHaveBeenCalled()
    expect(nodeService.createRectangle).not.toHaveBeenCalled()
  })
})
