import { NodeType } from '@latte-js/bean'
import { describe, expect, it } from 'vitest'

import { NULL_INDEX } from '../../config'
import { SceneGraph } from '../../sceneGraph'
import { HierarchyOps } from '../hierarchyOps'

describe('HierarchyOps', () => {
  it('getParent/setParent reads and writes parent array', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:p')
    const child = graph.createNode(NodeType.FRAME, 'test:c')

    expect(HierarchyOps.getParent(graph, child)).toBe(NULL_INDEX)

    HierarchyOps.setParent(graph, child, parent)
    expect(HierarchyOps.getParent(graph, child)).toBe(parent)
  })

  it('getParent/setParent with NULL_INDEX', () => {
    const graph = new SceneGraph()
    const child = graph.createNode(NodeType.FRAME, 'test:c')
    HierarchyOps.setParent(graph, child, NULL_INDEX)
    expect(HierarchyOps.getParent(graph, child)).toBe(NULL_INDEX)
  })

  it('setParent should mark dirty if needed (if it was intended)', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:r')
    expect(() => HierarchyOps.setParent(graph, idx, 10)).not.toThrow()
  })

  it('appendChild delegates to SceneGraph.appendChild', () => {
    const graph = new SceneGraph()

    const parent = graph.createNode(NodeType.GROUP, 'test:p')
    const child = graph.createNode(NodeType.FRAME, 'test:c')

    HierarchyOps.appendChild(graph, parent, child)

    expect(graph.parent[child]).toBe(parent)
    expect(graph.firstChild[parent]).toBe(child)
    expect(graph.lastChild[parent]).toBe(child)
  })

  it('appendChild should handle re-appending', () => {
    const graph = new SceneGraph()
    const p1 = graph.createNode(NodeType.GROUP, 'test:p1')
    const p2 = graph.createNode(NodeType.GROUP, 'test:p2')
    const c = graph.createNode(NodeType.FRAME, 'test:c')
    HierarchyOps.appendChild(graph, p1, c)
    HierarchyOps.appendChild(graph, p2, c)
    expect(graph.parent[c]).toBe(p2)
  })

  it('appendChild should throw on cycle', () => {
    const graph = new SceneGraph()
    const n = graph.createNode(NodeType.FRAME, 'test:n')
    expect(() => HierarchyOps.appendChild(graph, n, n)).toThrow()
  })

  it('remove delegates to SceneGraph.deleteNode and clears uuid mapping', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:p')
    const childUuid = 'test:c'
    const child = graph.createNode(NodeType.FRAME, childUuid)

    graph.appendChild(parent, child)
    expect(graph.getIndex(childUuid)).toBe(child)

    HierarchyOps.remove(graph, child)

    expect(graph.getIndex(childUuid)).toBe(NULL_INDEX)
    expect(graph.parent[child]).toBe(NULL_INDEX)
  })

  it('remove on orphan node', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:r')
    expect(() => HierarchyOps.remove(graph, idx)).not.toThrow()
    expect(graph.getIndex('test:r')).toBe(NULL_INDEX)
  })

  it('detach should remove from parent but keep node', () => {
    const graph = new SceneGraph()
    const p = graph.createNode(NodeType.GROUP, 'test:p')
    const c = graph.createNode(NodeType.RECTANGLE, 'test:c')
    graph.appendChild(p, c)
    HierarchyOps.detach(graph, c)
    expect(graph.parent[c]).toBe(NULL_INDEX)
    expect(graph.getIndex('test:c')).toBe(c)
  })

  it('insertAfter should delegate correctly', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:p')
    const c1 = graph.createNode(NodeType.FRAME, 'test:c1')
    const c2 = graph.createNode(NodeType.FRAME, 'test:c2')

    graph.appendChild(parent, c1)
    HierarchyOps.insertAfter(graph, parent, c2, c1)

    expect(graph.nextSibling[c1]).toBe(c2)
    expect(graph.parent[c2]).toBe(parent)
  })

  it('insertAfter at the end', () => {
    const graph = new SceneGraph()
    const p = graph.createNode(NodeType.GROUP, 'test:p')
    const c1 = graph.createNode(NodeType.FRAME, 'test:c1')
    const c2 = graph.createNode(NodeType.FRAME, 'test:c2')
    graph.appendChild(p, c1)
    HierarchyOps.insertAfter(graph, p, c2, c1)
    expect(graph.lastChild[p]).toBe(c2)
  })

  it('insertAfter when child already has parent', () => {
    const graph = new SceneGraph()
    const p1 = graph.createNode(NodeType.GROUP, 'test:p1')
    const p2 = graph.createNode(NodeType.GROUP, 'test:p2')
    const c = graph.createNode(NodeType.FRAME, 'test:c')
    const ref = graph.createNode(NodeType.FRAME, 'test:ref')
    graph.appendChild(p1, c)
    graph.appendChild(p2, ref)
    HierarchyOps.insertAfter(graph, p2, c, ref)
    expect(graph.parent[c]).toBe(p2)
    expect(graph.firstChild[p1]).toBe(NULL_INDEX)
  })

  it('getChildren should return all children indices', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:p')
    const c1 = graph.createNode(NodeType.FRAME, 'test:c1')
    const c2 = graph.createNode(NodeType.FRAME, 'test:c2')

    graph.appendChild(parent, c1)
    graph.appendChild(parent, c2)

    const children = HierarchyOps.getChildren(graph, parent)
    expect(children).toEqual([c1, c2])
  })

  it('getChildren should detect sibling cycles', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:p')
    const child = graph.createNode(NodeType.FRAME, 'test:c')

    graph.appendChild(parent, child)
    graph.nextSibling[child] = child

    expect(() => HierarchyOps.getChildren(graph, parent)).toThrow(
      'Tree cycle detected'
    )
  })

  it('getChildren should return empty array if no children', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:p')

    const children = HierarchyOps.getChildren(graph, parent)
    expect(children).toEqual([])
  })
})
