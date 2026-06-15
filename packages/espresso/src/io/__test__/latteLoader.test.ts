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
          guid: '0:rect-1',
          type: 'RECTANGLE',
          transform: [1, 0, 0, 1, 10, 20],
          size: { x: 100, y: 50 },
        },
      ],
    } as unknown as ILatteFile

    loader.load(json)

    const idx = graph.getIndex('0:rect-1')
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
          guid: '0:parent',
          type: 'FRAME',
          transform: [1, 0, 0, 1, 0, 0],
        },
        {
          guid: '0:child-2',
          type: 'RECTANGLE',
          parentIndex: { guid: '0:parent', position: '2' },
          transform: [1, 0, 0, 1, 0, 0],
        },
        {
          guid: '0:child-1',
          type: 'RECTANGLE',
          parentIndex: { guid: '0:parent', position: '1' },
          transform: [1, 0, 0, 1, 0, 0],
        },
      ],
    } as unknown as ILatteFile

    loader.load(json)

    const pIdx = graph.getIndex('0:parent')
    const c1Idx = graph.getIndex('0:child-1')
    const c2Idx = graph.getIndex('0:child-2')

    expect(graph.parent[c1Idx]).toBe(pIdx)
    expect(graph.parent[c2Idx]).toBe(pIdx)
    expect(graph.firstChild[pIdx]).toBe(c1Idx)
    expect(graph.nextSibling[c1Idx]).toBe(c2Idx)
    expect(graph.lastChild[pIdx]).toBe(c2Idx)
  })

  it('keeps file order stable when siblings have the same position', () => {
    const json = {
      elements: [
        {
          guid: '0:parent',
          type: 'FRAME',
          transform: [1, 0, 0, 1, 0, 0],
        },
        {
          guid: '0:child-a',
          type: 'RECTANGLE',
          parentIndex: { guid: '0:parent', position: '1' },
          transform: [1, 0, 0, 1, 0, 0],
        },
        {
          guid: '0:child-b',
          type: 'RECTANGLE',
          parentIndex: { guid: '0:parent', position: '1' },
          transform: [1, 0, 0, 1, 0, 0],
        },
      ],
    } as unknown as ILatteFile

    loader.load(json)

    const pIdx = graph.getIndex('0:parent')
    const aIdx = graph.getIndex('0:child-a')
    const bIdx = graph.getIndex('0:child-b')

    expect(graph.firstChild[pIdx]).toBe(aIdx)
    expect(graph.nextSibling[aIdx]).toBe(bIdx)
    expect(graph.lastChild[pIdx]).toBe(bIdx)
  })

  it('rejects loading while history mutation recording is active', () => {
    graph.setMutationRecorder({
      recordMutation() {},
    } as any)

    expect(() =>
      loader.load({ elements: [] } as unknown as ILatteFile)
    ).toThrow('[LatteLoader] load must run outside history mutation recording')
  })

  it('should map document nodes to the built-in root index', () => {
    const json = {
      elements: [
        {
          guid: '0:doc',
          type: 'DOCUMENT',
          transform: [1, 0, 0, 1, 0, 0],
        },
        {
          guid: '0:page',
          type: 'CANVAS',
          parentIndex: { guid: '0:doc', position: '1' },
          transform: [1, 0, 0, 1, 0, 0],
        },
      ],
    } as unknown as ILatteFile

    loader.load(json)

    const docIdx = graph.getIndex('0:doc')
    const pageIdx = graph.getIndex('0:page')

    expect(docIdx).toBe(0)
    expect(graph.parent[0]).toBe(-1)
    expect(graph.prevSibling[0]).toBe(-1)
    expect(graph.nextSibling[0]).toBe(-1)
    expect(graph.parent[pageIdx]).toBe(0)
    expect(graph.firstChild[0]).toBe(pageIdx)
    expect(graph.lastChild[0]).toBe(pageIdx)
  })

  it('should handle numeric type in JSON for backward compatibility', () => {
    const json = {
      elements: [{ guid: '0:rect-num', type: NodeType.RECTANGLE }],
    } as unknown as ILatteFile
    loader.load(json)
    const idx = graph.getIndex('0:rect-num')
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
          guid: '0:rect-fill',
          type: 'RECTANGLE',
          fillPaints: fills,
        },
      ],
    } as unknown as ILatteFile
    loader.load(json)
    const idx = graph.getIndex('0:rect-fill')
    const cursor = new NodeCursor(graph, idx)
    expect(cursor.fills).toEqual(fills)
  })

  it('should skip nodes with non-existent parent index', () => {
    const json = {
      elements: [
        {
          guid: '0:child-1',
          type: NodeType.RECTANGLE,
          parentIndex: { guid: '0:non-existent', position: '1' },
        },
      ],
    } as unknown as ILatteFile
    loader.load(json)
    const idx = graph.getIndex('0:child-1')
    expect(graph.parent[idx]).toBe(-1)
  })
})
