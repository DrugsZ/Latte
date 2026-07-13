import { Camera, type Renderer } from '@latte-js/art'
import { NodeType } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'
import { EditorHost } from '@latte-js/syrup'
import { describe, expect, it, vi } from 'vitest'

import { RendererHitTestService } from '../rendererHitTestService'

const createScene = () => {
  const graph = new SceneGraph()
  const rootId = 'test:root'
  const rootIndex = graph.createNode(NodeType.GROUP, rootId)
  const rectId = 'test:rect'
  const rectIndex = graph.createNode(NodeType.RECTANGLE, rectId)
  graph.appendChild(rootIndex, rectIndex)

  graph.size[rectIndex * 2] = 100
  graph.size[rectIndex * 2 + 1] = 100

  const matPtr = rectIndex * 6
  graph.worldMatrix[matPtr] = 1
  graph.worldMatrix[matPtr + 1] = 0
  graph.worldMatrix[matPtr + 2] = 0
  graph.worldMatrix[matPtr + 3] = 1
  graph.worldMatrix[matPtr + 4] = 10
  graph.worldMatrix[matPtr + 5] = 10

  const aabbPtr = rectIndex * 4
  graph.aabb[aabbPtr] = 10
  graph.aabb[aabbPtr + 1] = 10
  graph.aabb[aabbPtr + 2] = 110
  graph.aabb[aabbPtr + 3] = 110

  const rootAabbPtr = rootIndex * 4
  graph.aabb[rootAabbPtr] = -1000
  graph.aabb[rootAabbPtr + 1] = -1000
  graph.aabb[rootAabbPtr + 2] = 1000
  graph.aabb[rootAabbPtr + 3] = 1000

  return { graph, rootId, rectId, rectIndex }
}

const createRenderer = (
  rootId: string,
  queryHitTestCandidates: ReturnType<typeof vi.fn>,
  hitTestLayers: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue(null)
) =>
  ({
    activeRootId: rootId,
    camera: new Camera(1000, 1000),
    hitTestLayers,
    queryHitTestCandidates,
  }) as unknown as Renderer

const createViewport = () =>
  ({
    getBoundingClientRect: () => ({
      left: 100,
      top: 50,
      right: 1100,
      bottom: 1050,
      width: 1000,
      height: 1000,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    }),
  }) as HTMLElement

describe('RendererHitTestService', () => {
  it('uses canvas-local coordinates for hit testing and world coordinates for scene index query', () => {
    const { graph, rootId, rectId, rectIndex } = createScene()
    const queryHitTestCandidates = vi.fn().mockReturnValue([rectIndex])
    const renderer = createRenderer(rootId, queryHitTestCandidates)
    const service = new RendererHitTestService(
      new EditorHost(graph),
      renderer,
      createViewport()
    )

    const result = service.hitTest(660, 610)

    expect(queryHitTestCandidates).toHaveBeenCalledWith(60, 60, rootId)
    expect(result.viewport).toEqual({ x: 560, y: 560 })
    expect(result.world).toEqual({ x: 60, y: 60 })
    expect(result.hitResult).toEqual({ nodeIndex: rectIndex, nodeId: rectId })
  })

  it('falls back to full hit testing when scene index has no candidates', () => {
    const { graph, rootId, rectId, rectIndex } = createScene()
    const renderer = createRenderer(rootId, vi.fn().mockReturnValue([]))
    const service = new RendererHitTestService(
      new EditorHost(graph),
      renderer,
      createViewport()
    )

    const result = service.hitTest(660, 610)

    expect(result.hitResult).toEqual({ nodeIndex: rectIndex, nodeId: rectId })
  })

  it('uses render layer hit testing before scene node hit testing', () => {
    const { graph, rootId } = createScene()
    const queryHitTestCandidates = vi.fn().mockReturnValue([])
    const hitTestLayers = vi.fn().mockReturnValue({
      layerId: 'test-layer',
      targetId: 'test-target',
      data: { role: 'handle' },
    })
    const renderer = createRenderer(
      rootId,
      queryHitTestCandidates,
      hitTestLayers
    )
    const service = new RendererHitTestService(
      new EditorHost(graph),
      renderer,
      createViewport()
    )

    const result = service.hitTest(660, 610)

    expect(hitTestLayers).toHaveBeenCalledWith({
      viewport: { x: 560, y: 560 },
      world: { x: 60, y: 60 },
    })
    expect(queryHitTestCandidates).not.toHaveBeenCalled()
    expect(result.hitResult).toEqual({
      kind: 'render-layer',
      layerId: 'test-layer',
      targetId: 'test-target',
      payload: { role: 'handle' },
    })
  })

  it('skips hit testing while the projection revision is being written', () => {
    const { graph, rootId } = createScene()
    const queryHitTestCandidates = vi.fn().mockReturnValue([])
    const hitTestLayers = vi.fn().mockReturnValue(null)
    const renderer = createRenderer(
      rootId,
      queryHitTestCandidates,
      hitTestLayers
    )
    const service = new RendererHitTestService(
      new EditorHost(graph),
      renderer,
      createViewport()
    )

    graph.beginPublicationWrite()
    const result = service.hitTest(660, 610)

    expect(result.hitResult).toBeUndefined()
    expect(hitTestLayers).not.toHaveBeenCalled()
    expect(queryHitTestCandidates).not.toHaveBeenCalled()
  })
})
