import { NodeType } from '@latte-js/bean'
import { DIRTY_GEOMETRY, SceneGraph, TransformOps } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { DirtyBatch } from '../../pipeline/dirtyBatch'
import { AABBSystem } from '../aabb'

const readAABB = (graph: SceneGraph, index: number) =>
  Array.from(TransformOps.getAABB(graph, index))

describe('AABBSystem', () => {
  it('updates shared ancestors after all dirty sibling bounds are fresh', () => {
    const graph = new SceneGraph()
    const group = graph.createNode(NodeType.GROUP, 'test:group')
    const left = graph.createNode(NodeType.RECTANGLE, 'test:left')
    const right = graph.createNode(NodeType.RECTANGLE, 'test:right')
    graph.appendChild(0, group)
    graph.appendChild(group, left)
    graph.appendChild(group, right)

    TransformOps.setWidth(graph, left, 10)
    TransformOps.setHeight(graph, left, 10)
    TransformOps.setWorldMatrix(graph, left, [1, 0, 0, 1, 0, 0])

    TransformOps.setWidth(graph, right, 10)
    TransformOps.setHeight(graph, right, 10)
    TransformOps.setWorldMatrix(graph, right, [1, 0, 0, 1, 100, 0])

    const system = new AABBSystem(graph)
    system.process(
      DirtyBatch.from(
        new Map([
          [left, DIRTY_GEOMETRY],
          [right, DIRTY_GEOMETRY],
        ])
      )
    )

    expect(readAABB(graph, group)).toEqual([0, 0, 110, 10])
  })
})
