import { NodeType } from '@latte-js/bean'
import { DIRTY_TRANSFORM, SceneGraph, TransformOps } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { MatrixSystem } from '../matrix'

describe('MatrixSystem', () => {
  it('computes child world transform from parent world and child local matrices', () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    graph.appendChild(0, page)
    graph.appendChild(page, rect)
    TransformOps.setMatrix(graph, rect, [1, 0, 0, 1, -607, -825])

    const system = new MatrixSystem(graph)
    system.process(new Map([[0, DIRTY_TRANSFORM]]))

    const world = TransformOps.getWorldMatrix(graph, rect)
    expect(Array.from(world)).toEqual([1, 0, 0, 1, -607, -825])
  })

  it('throws a clear error when the tree contains a cycle', () => {
    const graph = new SceneGraph()
    graph.firstChild[0] = 0
    graph.nextSibling[0] = -1

    const system = new MatrixSystem(graph)

    expect(() => system.process(new Map([[0, DIRTY_TRANSFORM]]))).toThrow(
      'Tree cycle detected'
    )
  })
})
