import { NodeType, type IDType } from '@latte-js/bean'
import {
  Camera,
  PaintStyle,
  RenderCommandType,
  type RenderLayerEncodeContext,
  type RenderLayerHitTestContext,
} from '@latte-js/art'
import { SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { SelectionService } from '../../services/selection/selectionService'
import {
  SELECTION_OVERLAY_LAYER_ID,
  SelectionOverlayHitType,
  SelectionOverlayTargetId,
  SelectionOverlayLayer,
} from '../selectionOverlayLayer'

const setBounds = (
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

const setRectShape = (
  graph: SceneGraph,
  index: number,
  width: number,
  height: number,
  matrix: readonly [number, number, number, number, number, number]
) => {
  graph.size[index * 2] = width
  graph.size[index * 2 + 1] = height
  const ptr = index * 6
  for (let i = 0; i < matrix.length; i += 1) {
    graph.worldMatrix[ptr + i] = matrix[i]
  }
}

const createFixture = () => {
  const graph = new SceneGraph()
  const rootId: IDType = 'test:page'
  const root = graph.createNode(NodeType.CANVAS, rootId)
  graph.appendChild(0, root)
  const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')
  graph.appendChild(root, rect)
  setBounds(graph, rect, 10, 20, 110, 70)
  setRectShape(graph, rect, 100, 50, [1, 0, 0, 1, 10, 20])
  const camera = new Camera(200, 200)
  const selection = new SelectionService(graph)
  const layer = new SelectionOverlayLayer(selection)
  return { graph, rootId, camera, selection, layer }
}

const createEncodeContext = (
  fixture: ReturnType<typeof createFixture>
): RenderLayerEncodeContext => ({
  sceneGraph: fixture.graph,
  camera: fixture.camera,
  backendSize: { width: 200, height: 200, dpr: 1 },
  reasons: [],
  activeRootId: fixture.rootId,
})

const createHitTestContext = (
  fixture: ReturnType<typeof createFixture>
): RenderLayerHitTestContext => ({
  sceneGraph: fixture.graph,
  camera: fixture.camera,
  activeRootId: fixture.rootId,
})

describe('SelectionOverlayLayer', () => {
  it('does not encode commands for empty selection', () => {
    const fixture = createFixture()

    expect(fixture.layer.encode(createEncodeContext(fixture))).toBeNull()
  })

  it('encodes selection bounds and handle commands', () => {
    const fixture = createFixture()
    fixture.selection.select(['test:rect'])

    const buffer = fixture.layer.encode(createEncodeContext(fixture))!

    expect(buffer.pass.clear).toBeUndefined()
    expect(buffer.commands).toHaveLength(17)
    expect(buffer.commands[0]).toMatchObject({
      type: RenderCommandType.DrawRect,
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      transform: Float32Array.from([1, 0, 0, 1, 110, 120]),
      paint: {
        style: PaintStyle.Stroke,
      },
    })
  })

  it('encodes single rotated selection as an oriented bounds command', () => {
    const fixture = createFixture()
    const rect = fixture.graph.getIndex('test:rect')
    setBounds(fixture.graph, rect, -40, 20, 10, 120)
    setRectShape(fixture.graph, rect, 100, 50, [0, 1, -1, 0, 10, 20])
    fixture.selection.select(['test:rect'])

    const buffer = fixture.layer.encode(createEncodeContext(fixture))!

    expect(buffer.commands[0]).toMatchObject({
      type: RenderCommandType.DrawRect,
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      transform: Float32Array.from([0, 1, -1, 0, 110, 120]),
      paint: {
        style: PaintStyle.Stroke,
      },
    })
  })

  it('hit-tests handles before selection bounds', () => {
    const fixture = createFixture()
    fixture.selection.select(['test:rect'])

    const result = fixture.layer.hitTest(
      {
        viewport: { x: 110, y: 120 },
        world: { x: 10, y: 20 },
      },
      createHitTestContext(fixture)
    )

    expect(result).toEqual({
      layerId: SELECTION_OVERLAY_LAYER_ID,
      targetId: 'resize-nw',
      data: {
        type: SelectionOverlayHitType.ResizeHandle,
        ids: ['test:rect'],
        direction: 'nw',
      },
    })
  })

  it('hit-tests selection bounds', () => {
    const fixture = createFixture()
    fixture.selection.select(['test:rect'])

    const result = fixture.layer.hitTest(
      {
        viewport: { x: 130, y: 120 },
        world: { x: 30, y: 20 },
      },
      createHitTestContext(fixture)
    )

    expect(result).toEqual({
      layerId: SELECTION_OVERLAY_LAYER_ID,
      targetId: SelectionOverlayTargetId.SelectionBounds,
      data: {
        type: SelectionOverlayHitType.SelectionBounds,
        ids: ['test:rect'],
      },
    })
  })

  it('returns null when overlay is not hit', () => {
    const fixture = createFixture()
    fixture.selection.select(['test:rect'])

    expect(
      fixture.layer.hitTest(
        {
          viewport: { x: 20, y: 20 },
          world: { x: -80, y: -80 },
        },
        createHitTestContext(fixture)
      )
    ).toBeNull()
  })
})
