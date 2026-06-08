import { NodeType } from '@latte-js/bean'
import {
  DIRTY_LOCAL_MATRIX,
  SceneGraph,
  TransformOps,
} from '@latte-js/espresso'
import { mat2d } from 'gl-matrix'
import { describe, expect, it } from 'vitest'

import { DirtyBatch } from '../../pipeline/dirtyBatch'
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
    system.process(DirtyBatch.from(new Map([[0, DIRTY_LOCAL_MATRIX]])))

    const world = TransformOps.getWorldMatrix(graph, rect)
    expect(Array.from(world)).toEqual([1, 0, 0, 1, -607, -825])
  })

  it('uses standard affine composition for rotated parents', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(0, parent)
    graph.appendChild(parent, child)

    const parentLocal = mat2d.create()
    mat2d.translate(parentLocal, parentLocal, [100, 50])
    mat2d.rotate(parentLocal, parentLocal, Math.PI / 2)
    TransformOps.setMatrix(graph, parent, parentLocal)
    TransformOps.setMatrix(graph, child, [1, 0, 0, 1, 20, 0])

    const system = new MatrixSystem(graph)
    system.process(DirtyBatch.from(new Map([[0, DIRTY_LOCAL_MATRIX]])))

    const world = TransformOps.getWorldMatrix(graph, child)
    expect(Array.from(world).map(value => Math.round(value))).toEqual([
      0, 1, -1, 0, 100, 70,
    ])
  })

  it('throws a clear error when the tree contains a cycle', () => {
    const graph = new SceneGraph()
    graph.firstChild[0] = 0
    graph.nextSibling[0] = -1

    const system = new MatrixSystem(graph)

    expect(() =>
      system.process(DirtyBatch.from(new Map([[0, DIRTY_LOCAL_MATRIX]])))
    ).toThrow('Tree cycle detected')
  })
})
