import { NodeType } from '@latte-js/bean'
import {
  DIRTY_LOCAL_MATRIX,
  DIRTY_SUBTREE_MATRIX,
  DIRTY_TREE,
  DIRTY_WORLD_BOUNDS,
  SceneGraph,
  TransformOps,
} from '@latte-js/espresso'
import { mat2d } from 'gl-matrix'
import { describe, expect, it } from 'vitest'

import { DirtyBatch } from '../../pipeline/dirtyBatch'
import { MatrixSystem } from '../matrix'

const translation = (x: number, y: number = 0): mat2d => [1, 0, 0, 1, x, y]

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

  it('uses subtree markers to reach dirty descendants without updating clean ancestors', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const child = graph.createNode(NodeType.GROUP, 'test:child')
    const leaf = graph.createNode(NodeType.RECTANGLE, 'test:leaf')
    graph.appendChild(0, parent)
    graph.appendChild(parent, child)
    graph.appendChild(child, leaf)

    TransformOps.setMatrix(graph, parent, translation(100))
    TransformOps.setMatrix(graph, child, translation(20))
    TransformOps.setMatrix(graph, leaf, translation(1))

    const system = new MatrixSystem(graph)
    system.process(DirtyBatch.from(new Map([[0, DIRTY_LOCAL_MATRIX]])))

    TransformOps.setMatrix(graph, leaf, translation(7))
    const batch = DirtyBatch.from(
      new Map([
        [parent, DIRTY_SUBTREE_MATRIX],
        [child, DIRTY_SUBTREE_MATRIX],
        [leaf, DIRTY_LOCAL_MATRIX],
      ])
    )
    system.process(batch)

    expect(Array.from(TransformOps.getWorldMatrix(graph, leaf))).toEqual(
      translation(127)
    )
    expect(batch.hasFlags(leaf, DIRTY_WORLD_BOUNDS)).toBe(true)
    expect(batch.hasFlags(parent, DIRTY_WORLD_BOUNDS)).toBe(false)
    expect(batch.hasFlags(child, DIRTY_WORLD_BOUNDS)).toBe(false)
  })

  it('updates the full descendant subtree when a parent matrix changes', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const child = graph.createNode(NodeType.GROUP, 'test:child')
    const leaf = graph.createNode(NodeType.RECTANGLE, 'test:leaf')
    graph.appendChild(0, parent)
    graph.appendChild(parent, child)
    graph.appendChild(child, leaf)

    TransformOps.setMatrix(graph, parent, translation(100))
    TransformOps.setMatrix(graph, child, translation(20))
    TransformOps.setMatrix(graph, leaf, translation(5))

    const batch = DirtyBatch.from(new Map([[parent, DIRTY_LOCAL_MATRIX]]))
    new MatrixSystem(graph).process(batch)

    expect(Array.from(TransformOps.getWorldMatrix(graph, child))).toEqual(
      translation(120)
    )
    expect(Array.from(TransformOps.getWorldMatrix(graph, leaf))).toEqual(
      translation(125)
    )
    expect(batch.hasFlags(parent, DIRTY_WORLD_BOUNDS)).toBe(true)
    expect(batch.hasFlags(child, DIRTY_WORLD_BOUNDS)).toBe(true)
    expect(batch.hasFlags(leaf, DIRTY_WORLD_BOUNDS)).toBe(true)
  })

  it('recomputes a reparented subtree from its new parent world matrix', () => {
    const graph = new SceneGraph()
    const oldParent = graph.createNode(NodeType.GROUP, 'test:old-parent')
    const newParent = graph.createNode(NodeType.GROUP, 'test:new-parent')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(0, oldParent)
    graph.appendChild(0, newParent)
    graph.appendChild(oldParent, child)

    TransformOps.setMatrix(graph, oldParent, translation(100))
    TransformOps.setMatrix(graph, newParent, translation(200))
    TransformOps.setMatrix(graph, child, translation(10))

    const system = new MatrixSystem(graph)
    system.process(DirtyBatch.from(new Map([[0, DIRTY_LOCAL_MATRIX]])))

    graph.appendChild(newParent, child)
    system.process(DirtyBatch.from(new Map([[child, DIRTY_TREE]])))

    expect(Array.from(TransformOps.getWorldMatrix(graph, child))).toEqual(
      translation(210)
    )
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
