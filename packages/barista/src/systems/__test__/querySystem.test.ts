import { NodeType } from '@latte-js/bean'
import { SceneGraph, writeNodeName } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { QuerySystem } from '../query'

describe('QuerySystem', () => {
  it('reads names through the shared projection columns', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    graph.appendChild(0, rect)
    writeNodeName(graph, rect, 'Shared Rect')

    const query = new QuerySystem(graph)

    expect(query.getElementsByName('Shared Rect')).toEqual(['test:rect'])
  })

  it('returns query results in document order', () => {
    const graph = new SceneGraph()
    const first = graph.createNode(NodeType.RECTANGLE, 'test:first')
    const second = graph.createNode(NodeType.RECTANGLE, 'test:second')
    const third = graph.createNode(NodeType.RECTANGLE, 'test:third')
    graph.appendChild(0, first)
    graph.appendChild(0, second)
    graph.appendChild(0, third)

    const query = new QuerySystem(graph)

    expect(query.getElementsByType(NodeType.RECTANGLE)).toEqual([
      'test:first',
      'test:second',
      'test:third',
    ])
  })

  it('scopes query results to a root without including the root by default', () => {
    const graph = new SceneGraph()
    const group = graph.createNode(NodeType.GROUP, 'test:group')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(0, group)
    graph.appendChild(group, child)

    const query = new QuerySystem(graph)

    expect(
      query.getElementsByType(NodeType.GROUP, {
        rootIndex: group,
      })
    ).toEqual([])
    expect(
      query.getElementsByType(NodeType.GROUP, {
        rootIndex: group,
        includeRoot: true,
      })
    ).toEqual(['test:group'])
  })
})
