import { NodeType } from '@latte-js/bean'
import { describe, expect, it } from 'vitest'

import { SceneGraph } from '../../data/sceneGraph'
import { walkTree } from '../treeWalker'

describe('walkTree', () => {
  it('walks the tree from the requested root', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:p')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:c')

    graph.appendChild(0, parent)
    graph.appendChild(parent, child)

    expect(Array.from(walkTree(graph, parent))).toEqual([parent, child])
  })

  it('walks siblings in document order', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:p')
    const first = graph.createNode(NodeType.RECTANGLE, 'test:first')
    const second = graph.createNode(NodeType.RECTANGLE, 'test:second')
    const third = graph.createNode(NodeType.RECTANGLE, 'test:third')

    graph.appendChild(parent, first)
    graph.appendChild(parent, second)
    graph.appendChild(parent, third)

    expect(Array.from(walkTree(graph, parent))).toEqual([
      parent,
      first,
      second,
      third,
    ])
  })

  it('detects sibling cycles', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:p')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:c')

    graph.appendChild(parent, child)
    graph.nextSibling[child] = child

    expect(() => Array.from(walkTree(graph, parent))).toThrow(
      'Tree cycle detected'
    )
  })

  it('detects descendant cycles back to an ancestor', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:p')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:c')

    graph.appendChild(parent, child)
    graph.firstChild[child] = parent

    expect(() => Array.from(walkTree(graph, parent))).toThrow(
      'Tree cycle detected'
    )
  })

  it('rejects unallocated roots', () => {
    const graph = new SceneGraph()

    expect(() => Array.from(walkTree(graph, 9999))).toThrow(
      'Invalid node index'
    )
  })
})
