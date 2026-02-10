import { NodeType } from '@latte-js/bean'
import { mat2d } from 'gl-matrix'
import { describe, expect, it } from 'vitest'

import { MAT_A, MAT_D, MAT_SIZE, MAT_TX, MAT_TY } from '../../config'
import { SceneGraph } from '../../sceneGraph'
import { TransformOps } from '../transformOps'

describe('TransformOps', () => {
  it('getX/setX and getY/setY read and write translation', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.FRAME, 'test:n')

    TransformOps.setX(graph, idx, 12)
    TransformOps.setY(graph, idx, 34)

    expect(TransformOps.getX(graph, idx)).toBe(12)
    expect(TransformOps.getY(graph, idx)).toBe(34)

    const base = idx * MAT_SIZE
    expect(graph.matrix[base + MAT_TX]).toBe(12)
    expect(graph.matrix[base + MAT_TY]).toBe(34)
  })

  it('getX/setX and getY/setY handle negative values', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')
    TransformOps.setX(graph, idx, -100)
    TransformOps.setY(graph, idx, -200)
    expect(TransformOps.getX(graph, idx)).toBe(-100)
    expect(TransformOps.getY(graph, idx)).toBe(-200)
  })

  it('getX/setX and getY/setY handle zero', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')
    TransformOps.setX(graph, idx, 0)
    TransformOps.setY(graph, idx, 0)
    expect(TransformOps.getX(graph, idx)).toBe(0)
    expect(TransformOps.getY(graph, idx)).toBe(0)
  })

  it('getWidth/setWidth and getHeight/setHeight read and write size', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.FRAME, 'test:n')

    TransformOps.setWidth(graph, idx, 100)
    TransformOps.setHeight(graph, idx, 200)

    expect(TransformOps.getWidth(graph, idx)).toBe(100)
    expect(TransformOps.getHeight(graph, idx)).toBe(200)
  })

  it('getWidth/setWidth and getHeight/setHeight handle large values', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.FRAME, 'test:n')
    TransformOps.setWidth(graph, idx, 1000000)
    TransformOps.setHeight(graph, idx, 2000000)
    expect(TransformOps.getWidth(graph, idx)).toBe(1000000)
    expect(TransformOps.getHeight(graph, idx)).toBe(2000000)
  })

  it('getWidth/setWidth and getHeight/setHeight handle zero', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.FRAME, 'test:n')
    TransformOps.setWidth(graph, idx, 0)
    TransformOps.setHeight(graph, idx, 0)
    expect(TransformOps.getWidth(graph, idx)).toBe(0)
    expect(TransformOps.getHeight(graph, idx)).toBe(0)
  })

  it('setMatrix/getMatrix roundtrip', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.FRAME, 'test:n')

    const m = mat2d.fromValues(1, 2, 3, 4, 5, 6)
    TransformOps.setMatrix(graph, idx, m)

    const out = mat2d.create()
    TransformOps.getMatrix(graph, idx, out)

    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('identityMatrix resets to identity', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.FRAME, 'test:n')

    const m = mat2d.fromValues(9, 8, 7, 6, 5, 4)
    TransformOps.setMatrix(graph, idx, m)
    TransformOps.identityMatrix(graph, idx)

    const base = idx * MAT_SIZE
    expect(graph.matrix[base + 0]).toBe(1)
    expect(graph.matrix[base + 1]).toBe(0)
    expect(graph.matrix[base + 2]).toBe(0)
    expect(graph.matrix[base + 3]).toBe(1)
    expect(graph.matrix[base + 4]).toBe(0)
    expect(graph.matrix[base + 5]).toBe(0)

    expect(graph.matrix[base + MAT_A]).toBe(1)
    expect(graph.matrix[base + MAT_D]).toBe(1)
  })

  it('getTransform should return full matrix values', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.FRAME, 'test:n')
    const m = mat2d.fromValues(1, 2, 3, 4, 5, 6)
    TransformOps.setMatrix(graph, idx, m)

    const transform = TransformOps.getMatrix(graph, idx)
    expect(Array.from(transform)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('setTransform should write full matrix values', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.FRAME, 'test:n')
    const m = [1, 2, 3, 4, 5, 6]

    TransformOps.setMatrix(graph, idx, m)

    const out = mat2d.create()
    TransformOps.getMatrix(graph, idx, out)
    expect(Array.from(out)).toEqual(m)
  })
})
