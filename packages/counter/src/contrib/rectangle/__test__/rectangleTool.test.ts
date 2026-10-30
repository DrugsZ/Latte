import { FillType, NodeType } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'
import { describe, expect, it, vi } from 'vitest'

import { SelectionService } from '../../../services/selection/selectionService'
import { RectangleTool } from '../rectangleTool'

describe('RectangleTool', () => {
  it('creates and selects a rectangle under the active page', async () => {
    const nodeService = {
      createNode: vi.fn().mockResolvedValue('rectangle:test'),
      appendChild: vi.fn().mockResolvedValue('rectangle:test'),
    }
    const pageService = {
      ensureActivePage: vi.fn().mockResolvedValue('page:test'),
    }
    const selectionService = new SelectionService(new SceneGraph())
    const tool = new RectangleTool(
      nodeService as any,
      pageService as any,
      selectionService
    )

    tool.onPointerDown({ world: { x: 24, y: 36 } } as any)
    await vi.waitFor(() => expect(selectionService.ids).toHaveLength(1))

    expect(nodeService.createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NodeType.RECTANGLE,
        parentId: 'page:test',
        name: 'Rectangle',
        fills: [
          expect.objectContaining({
            type: FillType.SOLID,
            visible: true,
            opacity: 1,
          }),
        ],
        x: 24,
        y: 36,
        width: 100,
        height: 100,
      })
    )
    expect(nodeService.appendChild).not.toHaveBeenCalled()
    expect(selectionService.ids).toEqual([
      (nodeService.createNode.mock.calls[0][0] as { id: string }).id,
    ])
  })

  it('does nothing when the active page is unavailable', async () => {
    const nodeService = { createNode: vi.fn(), appendChild: vi.fn() }
    const pageService = {
      ensureActivePage: vi.fn().mockResolvedValue(null),
    }
    const tool = new RectangleTool(
      nodeService as any,
      pageService as any,
      new SelectionService(new SceneGraph())
    )

    tool.onPointerDown({ world: { x: 24, y: 36 } } as any)
    await Promise.resolve()

    expect(nodeService.createNode).not.toHaveBeenCalled()
    expect(nodeService.appendChild).not.toHaveBeenCalled()
  })

  it('does not create a rectangle on right click', async () => {
    const nodeService = { createNode: vi.fn() }
    const pageService = { ensureActivePage: vi.fn() }
    const tool = new RectangleTool(
      nodeService as any,
      pageService as any,
      new SelectionService(new SceneGraph())
    )

    tool.onPointerDown({ rightButton: true, world: { x: 24, y: 36 } } as any)
    await Promise.resolve()

    expect(pageService.ensureActivePage).not.toHaveBeenCalled()
    expect(nodeService.createNode).not.toHaveBeenCalled()
  })
})
