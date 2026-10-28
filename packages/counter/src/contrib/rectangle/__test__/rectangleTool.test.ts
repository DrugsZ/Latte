import { NodeType } from '@latte-js/bean'
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
    await vi.waitFor(() => expect(nodeService.appendChild).toHaveBeenCalled())

    expect(nodeService.createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NodeType.RECTANGLE,
        x: 24,
        y: 36,
        width: 100,
        height: 100,
      })
    )
    expect(nodeService.appendChild).toHaveBeenCalledWith(
      'page:test',
      expect.stringMatching(/^rectangle:/)
    )
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
})
