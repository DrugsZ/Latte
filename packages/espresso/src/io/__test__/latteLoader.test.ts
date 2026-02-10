import { NodeType, type ILatteFile } from '@latte-js/bean'
import { beforeEach, describe, expect, it } from 'vitest'

import { NodeCursor } from '../../data/nodeCursor'
import { SceneGraph } from '../../data/sceneGraph'
import { LatteLoader } from '../latteLoader'

describe('LatteLoader', () => {
  let graph: SceneGraph
  let loader: LatteLoader

  beforeEach(() => {
    graph = new SceneGraph()
    loader = new LatteLoader(graph)
  })

  it('should load a simple tree correctly', () => {
    const json = {
      elements: [
        {
          guid: 'rect-1',
          type: 'RECTANGLE',
          transform: [1, 0, 0, 1, 10, 20],
          size: { x: 100, y: 50 },
        },
      ],
    } as unknown as ILatteFile

    loader.load(json)

    const idx = graph.getIndex('rect-1')
    expect(idx).not.toBe(-1)
    expect(graph.type[idx]).toBe(NodeType.RECTANGLE)
    expect(graph.matrix[idx * 6 + 4]).toBe(10)
    expect(graph.matrix[idx * 6 + 5]).toBe(20)
    expect(graph.size[idx * 2]).toBe(100)
    expect(graph.size[idx * 2 + 1]).toBe(50)
  })

  it('should maintain hierarchy and sibling order', () => {
    const json = {
      elements: [
        {
          guid: 'parent',
          type: 'FRAME',
          transform: [1, 0, 0, 1, 0, 0],
        },
        {
          guid: 'child-2',
          type: 'RECTANGLE',
          parentIndex: { guid: 'parent', position: '2' },
          transform: [1, 0, 0, 1, 0, 0],
        },
        {
          guid: 'child-1',
          type: 'RECTANGLE',
          parentIndex: { guid: 'parent', position: '1' },
          transform: [1, 0, 0, 1, 0, 0],
        },
      ],
    } as unknown as ILatteFile

    loader.load(json)

    const pIdx = graph.getIndex('parent')
    const c1Idx = graph.getIndex('child-1')
    const c2Idx = graph.getIndex('child-2')

    expect(graph.parent[c1Idx]).toBe(pIdx)
    expect(graph.parent[c2Idx]).toBe(pIdx)
    expect(graph.firstChild[pIdx]).toBe(c1Idx)
    expect(graph.nextSibling[c1Idx]).toBe(c2Idx)
    expect(graph.lastChild[pIdx]).toBe(c2Idx)
  })

  it('should handle numeric type in JSON for backward compatibility', () => {
    const json = {
      elements: [{ guid: 'rect-num', type: NodeType.RECTANGLE }],
    } as unknown as ILatteFile
    loader.load(json)
    const idx = graph.getIndex('rect-num')
    expect(graph.type[idx]).toBe(NodeType.RECTANGLE)
  })

  it('should load fills from fillPaints', () => {
    const fills = [
      {
        type: 'SOLID',
        color: { r: 1, g: 0, b: 0, a: 1 },
        visible: true,
        opacity: 1,
      },
    ]
    const json = {
      elements: [
        {
          guid: 'rect-fill',
          type: 'RECTANGLE',
          fillPaints: fills,
        },
      ],
    } as unknown as ILatteFile
    loader.load(json)
    const idx = graph.getIndex('rect-fill')
    const cursor = new NodeCursor(graph, idx)
    expect(cursor.fills).toEqual(fills)
  })

  it('should skip nodes with non-existent parent index', () => {
    const json = {
      elements: [
        {
          guid: 'child-1',
          type: NodeType.RECTANGLE,
          parentIndex: { guid: 'non-existent', position: '1' },
        },
      ],
    } as unknown as ILatteFile
    loader.load(json)
    const idx = graph.getIndex('child-1')
    expect(graph.parent[idx]).toBe(-1)
  })
})
