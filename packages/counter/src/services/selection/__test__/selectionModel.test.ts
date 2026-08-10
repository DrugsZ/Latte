import { NodeType } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { SelectionModel } from '../selectionModel'
import { SelectionService } from '../selectionService'

const setWorldMatrix = (
  graph: SceneGraph,
  index: number,
  matrix: readonly [number, number, number, number, number, number]
) => {
  graph.worldMatrix.set(matrix, index * 6)
}

describe('SelectionModel', () => {
  it('builds and caches geometry snapshots by selection version and document revision', () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    const a = graph.createNode(NodeType.RECTANGLE, 'test:a')
    const b = graph.createNode(NodeType.RECTANGLE, 'test:b')
    graph.appendChild(0, page)
    graph.appendChild(page, a)
    graph.appendChild(page, b)
    graph.size[a * 2] = 20
    graph.size[a * 2 + 1] = 10
    graph.size[b * 2] = 20
    graph.size[b * 2 + 1] = 10
    graph.matrix[b * 6 + 4] = 40
    setWorldMatrix(graph, a, [1, 0, 0, 1, 0, 0])
    setWorldMatrix(graph, b, [1, 0, 0, 1, 40, 0])

    const selection = new SelectionService(graph)
    const model = new SelectionModel(selection, graph, { documentId: 'doc:a' })

    selection.select(['test:a', 'test:b'])
    const first = model.getSnapshot(7)
    const cached = model.getSnapshot(7)
    const nextRevision = model.getSnapshot(8)
    if (!first || !cached || !nextRevision) {
      throw new Error('expected consistent selection snapshots')
    }

    expect(cached).toBe(first)
    expect(nextRevision).not.toBe(first)
    expect(first.selectionVersion).toBe(selection.selectionVersion)
    expect(first.documentRevision).toBe(7)
    expect(first.requestedIds).toEqual(['test:a', 'test:b'])
    expect(first.targets.map(target => target.id)).toEqual(['test:a', 'test:b'])
    expect(first.geometry).toMatchObject({
      ids: ['test:a', 'test:b'],
      width: 60,
      height: 10,
      mode: 'multi-aabb',
    })

    selection.select(['test:a'])
    const single = model.getSnapshot(8)
    if (!single) {
      throw new Error('expected a consistent single selection snapshot')
    }

    expect(single).not.toBe(nextRevision)
    expect(single.geometry).toMatchObject({
      ids: ['test:a'],
      width: 20,
      height: 10,
      mode: 'single-obb',
    })
  })

  it('skips snapshot reads while the projection revision is being written', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    graph.size[rect * 2] = 20
    graph.size[rect * 2 + 1] = 10
    setWorldMatrix(graph, rect, [1, 0, 0, 1, 0, 0])

    const selection = new SelectionService(graph)
    const model = new SelectionModel(selection, graph)
    selection.select(['test:rect'])

    graph.beginPublicationWrite()

    expect(model.getSnapshot(1)).toBeNull()
  })

  it('does not return cached snapshots while the projection revision is being written', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    graph.size[rect * 2] = 20
    graph.size[rect * 2 + 1] = 10
    setWorldMatrix(graph, rect, [1, 0, 0, 1, 0, 0])

    const selection = new SelectionService(graph)
    const model = new SelectionModel(selection, graph)
    selection.select(['test:rect'])

    expect(model.getSnapshot(1)).not.toBeNull()

    graph.beginPublicationWrite()

    expect(model.getSnapshot(1)).toBeNull()
  })
})
