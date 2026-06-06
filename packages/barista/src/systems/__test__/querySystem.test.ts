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

    expect(query.getElementByName('Shared Rect')).toEqual(['test:rect'])
  })
})
