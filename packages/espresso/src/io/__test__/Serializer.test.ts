import { NodeType } from '@latte-js/bean'
import { beforeEach, describe, expect, it } from 'vitest'

import { NodeCursor } from '../../data/nodeCursor'
import { SceneGraph } from '../../data/sceneGraph'
import { Serializer } from '../Serializer'

import type {
  IFrameNode,
  IPageNode,
  IPaint,
  IRectangleNode,
} from '@latte-js/bean'

describe('Serializer', () => {
  let graph: SceneGraph
  let serializer: Serializer

  beforeEach(() => {
    graph = new SceneGraph()
    serializer = new Serializer(graph)
  })

  it('should serialize an empty graph (no nodes except root)', () => {
    // Act
    const result = serializer.serialize()

    // Assert
    // Serializer skips index 0 (root), so an empty graph has 0 elements
    expect(result.elements.length).toBe(0)
  })

  it('should serialize a flat list of nodes', () => {
    // Arrange
    graph.createNode(NodeType.RECTANGLE, 'test:rect')
    graph.createNode(NodeType.FRAME, 'test:frame')

    // Act
    const result = serializer.serialize()

    // Assert
    expect(result.elements.length).toBe(2) // 2 nodes, root skipped
    const types = result.elements.map(e => e.type)
    expect(types).toContain('RECTANGLE')
    expect(types).toContain('FRAME')
  })

  it('should serialize parent-child relationships', () => {
    // Arrange
    const p1 = graph.createNode(NodeType.FRAME, 'test:p1')
    const c1 = graph.createNode(NodeType.RECTANGLE, 'test:c1')
    graph.appendChild(p1, c1)

    // Act
    const result = serializer.serialize()

    // Assert
    const child = result.elements.find(e => e.guid === 'test:c1')
    expect(child?.parentIndex?.guid).toBe('test:p1')
    expect(child?.parentIndex?.position).toBe('1')
  })

  it('should calculate sibling positions correctly', () => {
    // Arrange
    const p1 = graph.createNode(NodeType.FRAME, 'test:p1')
    const c1 = graph.createNode(NodeType.RECTANGLE, 'test:c1')
    const c2 = graph.createNode(NodeType.RECTANGLE, 'test:c2')
    graph.appendChild(p1, c1)
    graph.appendChild(p1, c2)

    // Act
    const result = serializer.serialize()

    // Assert
    const node1 = result.elements.find(e => e.guid === 'test:c1')
    const node2 = result.elements.find(e => e.guid === 'test:c2')
    expect(node1?.parentIndex?.position).toBe('1')
    expect(node2?.parentIndex?.position).toBe('2')
  })

  it('should convert transform Float32Array to regular array', () => {
    // Arrange
    graph.createNode(NodeType.RECTANGLE, 'test:r1')
    // Identity is default

    // Act
    const result = serializer.serialize()
    const node = result.elements.find(e => e.guid === 'test:r1')

    // Assert
    expect(Array.isArray(node?.transform)).toBe(true)
    expect(node?.transform).toEqual([1, 0, 0, 1, 0, 0])
  })

  it('should skip invalid/deleted nodes', () => {
    // Arrange
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:r1')
    graph.deleteNode(idx)

    // Act
    const result = serializer.serialize()

    // Assert
    const node = result.elements.find(e => e.guid === 'test:r1')
    expect(node).toBeUndefined()
  })

  it('should serialize fillPaints for different node types', () => {
    const fills = [
      {
        type: 'SOLID',
        color: { r: 1, g: 0, b: 0, a: 1 },
        visible: true,
        opacity: 1,
      },
    ] as unknown as IPaint[]

    const pageIdx = graph.createNode(NodeType.CANVAS, 'test:page')
    const frameIdx = graph.createNode(NodeType.FRAME, 'test:frame')
    const rectIdx = graph.createNode(NodeType.RECTANGLE, 'test:rect')

    new NodeCursor(graph, pageIdx).fills = fills
    new NodeCursor(graph, frameIdx).fills = fills
    new NodeCursor(graph, rectIdx).fills = fills

    const result = serializer.serialize()

    const page = result.elements.find(
      e => e.guid === 'test:page'
    ) as unknown as IPageNode
    const frame = result.elements.find(
      e => e.guid === 'test:frame'
    ) as unknown as IFrameNode
    const rect = result.elements.find(
      e => e.guid === 'test:rect'
    ) as unknown as IRectangleNode

    expect(page.backgrounds).toEqual(fills)
    expect(frame.fillPaints).toEqual(fills)
    expect(rect.fillPaints).toEqual(fills)
  })

  it('toJSON should return stringified JSON', () => {
    graph.createNode(NodeType.RECTANGLE, 'test:r1')
    const json = serializer.toJSON(true)
    expect(typeof json).toBe('string')
    expect(json).toContain('"guid":"test:r1"')

    const prettyJson = serializer.toJSON(false)
    expect(prettyJson).toContain('\n')
  })

  it('should handle nodes with invalid type during serialization', () => {
    graph.createNode(999 as NodeType, 'test:invalid')
    const json = serializer.serialize()
    const node = json.elements.find(e => e.guid === 'test:invalid')
    expect(node?.type).toBe('GROUP')
  })
})
