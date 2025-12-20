import { describe, it, expect } from 'vitest'
import { NodeType, type IPaint } from '@latte-js/bean'
import { SceneGraph } from '../../sceneGraph'
import { StyleOps } from '../styleOps'

describe('StyleOps', () => {
  it('getStrokeWeight/setStrokeWeight', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')

    StyleOps.setStrokeWeight(graph, idx, 3)
    expect(StyleOps.getStrokeWeight(graph, idx)).toBe(3)
  })

  it('setStrokeWeight handles negative and zero', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')
    StyleOps.setStrokeWeight(graph, idx, 0)
    expect(StyleOps.getStrokeWeight(graph, idx)).toBe(0)
    StyleOps.setStrokeWeight(graph, idx, -5)
    expect(StyleOps.getStrokeWeight(graph, idx)).toBe(-5)
  })

  it('getStrokeAlign/setStrokeAlign', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')

    StyleOps.setStrokeAlign(graph, idx, 'INSIDE')
    expect(StyleOps.getStrokeAlign(graph, idx)).toBe('INSIDE')
  })

  it('setStrokeAlign handles different values', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')
    StyleOps.setStrokeAlign(graph, idx, 'OUTSIDE')
    expect(StyleOps.getStrokeAlign(graph, idx)).toBe('OUTSIDE')
    StyleOps.setStrokeAlign(graph, idx, 'CENTER')
    expect(StyleOps.getStrokeAlign(graph, idx)).toBe('CENTER')
  })

  it('getStrokeJoin/setStrokeJoin', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')

    StyleOps.setStrokeJoin(graph, idx, 'ROUND')
    expect(StyleOps.getStrokeJoin(graph, idx)).toBe('ROUND')
  })

  it('getStrokeStyle/setStrokeStyle', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')

    StyleOps.setStrokeStyle(graph, idx, 'DASH')
    expect(StyleOps.getStrokeStyle(graph, idx)).toBe('DASH')
  })

  it('getDashCap/setDashCap', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')

    StyleOps.setDashCap(graph, idx, 'ROUND')
    expect(StyleOps.getDashCap(graph, idx)).toBe('ROUND')
  })

  it('getLocked/setLocked', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')

    expect(StyleOps.getLocked(graph, idx)).toBe(false)
    StyleOps.setLocked(graph, idx, true)
    expect(StyleOps.getLocked(graph, idx)).toBe(true)
  })

  it('getVisible/setVisible', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')

    expect(StyleOps.getVisible(graph, idx)).toBe(true)
    StyleOps.setVisible(graph, idx, false)
    expect(StyleOps.getVisible(graph, idx)).toBe(false)
  })

  it('getOpacity/setOpacity', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')

    StyleOps.setOpacity(graph, idx, 0.5)
    expect(StyleOps.getOpacity(graph, idx)).toBe(0.5)
  })

  it('setOpacity handles boundary values', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')
    StyleOps.setOpacity(graph, idx, 0)
    expect(StyleOps.getOpacity(graph, idx)).toBe(0)
    StyleOps.setOpacity(graph, idx, 1)
    expect(StyleOps.getOpacity(graph, idx)).toBe(1)
  })

  it('getFills/setStyle', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')
    const fills = [
      { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } },
    ] as unknown as IPaint[]

    StyleOps.setStyle(graph, idx, fills)
    expect(StyleOps.getFills(graph, idx)).toEqual(fills)
  })

  it('setStyle with multiple fills', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')
    const fills = [
      { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } },
      { type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 } },
    ] as unknown as IPaint[]
    StyleOps.setStyle(graph, idx, fills)
    expect(StyleOps.getFills(graph, idx)).toEqual(fills)
  })

  it('getFills should return empty array if no fills', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')
    expect(StyleOps.getFills(graph, idx)).toEqual([])
  })

  it('should return empty array if blob read fails', () => {
    const graph = new SceneGraph()
    const idx = graph.createNode(NodeType.RECTANGLE, 'test:n')
    // Manually set a pointer that might fail read (e.g. 0 or out of bounds)
    graph.blobIndexToPtr.set(idx, 99999)
    expect(StyleOps.getFills(graph, idx)).toEqual([])
  })
})
