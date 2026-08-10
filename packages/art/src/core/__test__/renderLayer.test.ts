import { NodeType } from '@latte-js/bean'
import { NodeCursor, SceneGraph } from '@latte-js/espresso'
import { describe, expect, it, vi } from 'vitest'

import { Renderer } from '../render'

import {
  DEFAULT_RENDER_CAPABILITIES,
  RenderCommandBuffer,
  RenderCommandType,
} from '../../contract/renderBackend'

import type { IRenderBackendDriver } from '../../contract/renderBackend'
import type { RenderLayer } from '../renderLayer'

const createBackend = () => {
  const size = { width: 100, height: 100, dpr: 1 }
  return {
    type: 'test',
    capabilities: DEFAULT_RENDER_CAPABILITIES,
    init: vi.fn(),
    resize: vi.fn(),
    submit: vi.fn(),
    getSize: () => size,
    dispose: vi.fn(),
    getStats: () => ({
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      textures: 0,
    }),
    resetStats: vi.fn(),
  } satisfies IRenderBackendDriver
}

const createCommandLayer = (id: string, zIndex: number): RenderLayer => ({
  id,
  zIndex,
  encode() {
    const buffer = new RenderCommandBuffer()
    buffer.push({
      type: RenderCommandType.DrawImage,
      transform: new Float32Array([1, 0, 0, 1, 0, 0]),
      imageId: id,
      dx: 0,
      dy: 0,
      dw: 1,
      dh: 1,
    })
    return buffer
  },
})

const setAABB = (
  graph: SceneGraph,
  index: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
) => {
  const ptr = index * 4
  graph.aabb[ptr] = minX
  graph.aabb[ptr + 1] = minY
  graph.aabb[ptr + 2] = maxX
  graph.aabb[ptr + 3] = maxY
}

describe('Renderer render layers', () => {
  it('submits visible layers by ascending z-index after the scene layer', () => {
    const backend = createBackend()
    const renderer = new Renderer(new SceneGraph(), backend, {
      surface: { type: 'wasm-surface', handle: 1 },
      size: { width: 100, height: 100, dpr: 1 },
      autoStart: false,
    })
    renderer.registerLayer(createCommandLayer('high', 20))
    renderer.registerLayer(createCommandLayer('low', 10))
    ;(renderer as any)._render()

    const submitted = backend.submit.mock.calls.map(([buffer]) => buffer)
    expect(submitted[0].pass.clear).toMatchObject({
      width: 100,
      height: 100,
    })
    expect(
      submitted
        .slice(1)
        .map(buffer => (buffer.commands[0] as { imageId: string }).imageId)
    ).toEqual(['low', 'high'])
  })

  it('hit-tests layers by descending z-index', () => {
    const backend = createBackend()
    const renderer = new Renderer(new SceneGraph(), backend, {
      surface: { type: 'wasm-surface', handle: 1 },
      size: { width: 100, height: 100, dpr: 1 },
      autoStart: false,
    })

    renderer.registerLayer({
      id: 'low',
      zIndex: 10,
      encode: () => null,
      hitTest: () => ({ layerId: 'low', targetId: 'low-target' }),
    })
    renderer.registerLayer({
      id: 'high',
      zIndex: 20,
      encode: () => null,
      hitTest: () => ({ layerId: 'high', targetId: 'high-target' }),
    })

    expect(
      renderer.hitTestLayers({
        viewport: { x: 10, y: 10 },
        world: { x: 10, y: 10 },
      })
    ).toEqual({ layerId: 'high', targetId: 'high-target' })
  })

  it('does not fit to content while the scene revision is being written', () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    graph.appendChild(0, page)
    const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    graph.appendChild(page, rect)
    const cursor = new NodeCursor(graph, rect)
    cursor.width = 100
    cursor.height = 50

    const backend = createBackend()
    const renderer = new Renderer(graph, backend, {
      surface: { type: 'wasm-surface', handle: 1 },
      size: { width: 100, height: 100, dpr: 1 },
      autoStart: false,
    })

    graph.beginPublicationWrite()

    expect(renderer.fitToContent('test:page')).toBe(false)
  })

  it('defers scene index updates that arrive while the scene revision is being written', () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    graph.appendChild(0, page)
    const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    graph.appendChild(page, rect)
    setAABB(graph, rect, 1000, 1000, 1100, 1100)

    const backend = createBackend()
    const renderer = new Renderer(graph, backend, {
      surface: { type: 'wasm-surface', handle: 1 },
      size: { width: 100, height: 100, dpr: 1 },
      activeRootId: 'test:page',
      autoStart: false,
    })

    expect(renderer.queryHitTestCandidates(10, 10, 'test:page')).toEqual([])

    graph.beginPublicationWrite()
    setAABB(graph, rect, 0, 0, 100, 100)
    renderer.updateSceneIndexByIds(['test:rect'])
    graph.publishRevision()

    expect(renderer.queryHitTestCandidates(10, 10, 'test:page')).toEqual([])
    ;(renderer as unknown as { _render(): void })._render()

    expect(renderer.queryHitTestCandidates(10, 10, 'test:page')).toEqual([rect])
  })

  it('rebuilds the scene index when revision changes during a deferred update', () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    graph.appendChild(0, page)
    const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    graph.appendChild(page, rect)
    setAABB(graph, rect, 1000, 1000, 1100, 1100)

    const renderer = new Renderer(graph, createBackend(), {
      surface: { type: 'wasm-surface', handle: 1 },
      size: { width: 100, height: 100, dpr: 1 },
      activeRootId: 'test:page',
      autoStart: false,
    })
    const internals = renderer as any
    const sceneLayer = internals._sceneLayer
    const update = sceneLayer.updateSceneIndexByIds.bind(sceneLayer)
    const rebuild = vi.spyOn(sceneLayer, 'rebuildSceneIndex')

    graph.beginPublicationWrite()
    setAABB(graph, rect, 0, 0, 100, 100)
    renderer.updateSceneIndexByIds(['test:rect'])
    graph.publishRevision()

    vi.spyOn(sceneLayer, 'updateSceneIndexByIds').mockImplementationOnce(
      (...args: unknown[]) => {
        update(args[0] as Iterable<string>)
        graph.beginPublicationWrite()
        graph.publishRevision()
      }
    )

    internals._render()
    expect(internals._pendingSceneIndexRebuild).toBe(true)

    internals._render()
    expect(rebuild).toHaveBeenCalledTimes(1)
    expect(renderer.queryHitTestCandidates(10, 10, 'test:page')).toEqual([rect])
  })
})
