import { NodeType } from '@latte-js/bean'
import { SceneGraph } from '../../data/sceneGraph'
import { PositioningContextResolver } from '../positioningContextResolver'
import { describe, expect, it } from 'vitest'

describe('PositioningContextResolver', () => {
  it('skips transparent groups and stops at the nearest containing frame', () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    const frame = graph.createNode(NodeType.FRAME, 'test:frame')
    const outerGroup = graph.createNode(NodeType.GROUP, 'test:outer-group')
    const innerGroup = graph.createNode(NodeType.GROUP, 'test:inner-group')
    const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')

    graph.appendChild(0, page)
    graph.appendChild(page, frame)
    graph.appendChild(frame, outerGroup)
    graph.appendChild(outerGroup, innerGroup)
    graph.appendChild(innerGroup, rect)

    const resolver = new PositioningContextResolver(graph)

    expect(resolver.resolveById('test:rect')).toMatchObject({
      targetId: 'test:rect',
      directParentId: 'test:inner-group',
      containingParentId: 'test:frame',
      targetIndex: rect,
      directParentIndex: innerGroup,
      containingParentIndex: frame,
    })
  })

  it('resolves a selected group from its parent and falls back to the page', () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    const group = graph.createNode(NodeType.GROUP, 'test:group')

    graph.appendChild(0, page)
    graph.appendChild(page, group)

    const resolver = new PositioningContextResolver(graph)

    expect(resolver.resolveById('test:group')).toMatchObject({
      targetId: 'test:group',
      directParentId: 'test:page',
      containingParentId: 'test:page',
    })
  })

  it('skips groups above a selected frame', () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    const group = graph.createNode(NodeType.GROUP, 'test:group')
    const frame = graph.createNode(NodeType.FRAME, 'test:nested-frame')

    graph.appendChild(0, page)
    graph.appendChild(page, group)
    graph.appendChild(group, frame)

    const resolver = new PositioningContextResolver(graph)

    expect(resolver.resolveById('test:nested-frame')).toMatchObject({
      targetId: 'test:nested-frame',
      directParentId: 'test:group',
      containingParentId: 'test:page',
    })
  })
})
