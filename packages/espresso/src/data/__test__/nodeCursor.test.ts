import { BlendModeType, NodeType } from '@latte-js/bean'
import { beforeEach, describe, expect, it } from 'vitest'

import { NodeCursor } from '../nodeCursor'
import { SceneGraph } from '../sceneGraph'

import type { IPaint } from '@latte-js/bean'

describe('NodeCursor', () => {
  let graph: SceneGraph
  let root: NodeCursor

  beforeEach(() => {
    graph = new SceneGraph()
    root = new NodeCursor(graph, 0) // Root document node
  })

  describe('Lifecycle and Basic Access', () => {
    it('should initialize with correct index and generation', () => {
      expect(root.index).toBe(0)
      expect(root.type).toBe(NodeType.DOCUMENT)
    })

    it('should throw error when accessing dead node', () => {
      const idx = graph.createNode(NodeType.RECTANGLE, 'test:rect')
      const cursor = new NodeCursor(graph, idx)

      graph.deleteNode(idx)

      expect(() => cursor.type).toThrow('[NodeCursor] Accessing dead node')
    })

    it('should move to another index correctly', () => {
      const idx = graph.createNode(NodeType.FRAME, 'test:frame')
      root.to(idx)
      expect(root.index).toBe(idx)
      expect(root.id).toBe('test:frame')
    })

    // it('to(idx) should revert index on error', () => {
    //   const idx1 = graph.createNode(NodeType.RECTANGLE, 'test:r1')
    //   const cursor = new NodeCursor(graph, idx1)

    //   // index 9999 is invalid/dead
    //   expect(() => cursor.to(9999)).toThrow('Accessing dead node')
    //   expect(cursor.index).toBe(idx1)
    // })
  })

  describe('Property Accessors', () => {
    it('should get and set name', () => {
      const idx = graph.createNode(NodeType.FRAME, 'test:f')
      const cursor = new NodeCursor(graph, idx)
      expect(cursor.name).toBe('Layer')
      cursor.name = 'New Name'
      expect(cursor.name).toBe('New Name')
    })

    it('should get type and id', () => {
      const idx = graph.createNode(NodeType.RECTANGLE, 'test:r1')
      const cursor = new NodeCursor(graph, idx)
      expect(cursor.type).toBe(NodeType.RECTANGLE)
      expect(cursor.id).toBe('test:r1')
    })

    it('should handle opacity', () => {
      const idx = graph.createNode(NodeType.RECTANGLE, 'test:r')
      const cursor = new NodeCursor(graph, idx)
      expect(cursor.opacity).toBe(1.0)
      cursor.opacity = 0.5
      expect(cursor.opacity).toBe(0.5)
    })

    it('should handle visibility', () => {
      const idx = graph.createNode(NodeType.RECTANGLE, 'test:r')
      const cursor = new NodeCursor(graph, idx)
      expect(cursor.visible).toBe(true)
      cursor.visible = false
      expect(cursor.visible).toBe(false)
    })

    it('should handle locked state', () => {
      const idx = graph.createNode(NodeType.RECTANGLE, 'test:r')
      const cursor = new NodeCursor(graph, idx)
      expect(cursor.locked).toBe(false)
      cursor.locked = true
      expect(cursor.locked).toBe(true)
    })
  })

  describe('Hierarchy Operations', () => {
    it('appendChild and remove (detach)', () => {
      const pIdx = graph.createNode(NodeType.GROUP, 'test:p')
      const cIdx = graph.createNode(NodeType.RECTANGLE, 'test:c')
      const parent = new NodeCursor(graph, pIdx)
      const child = new NodeCursor(graph, cIdx)

      parent.appendChild(child)
      expect(child.parent?.index).toBe(pIdx)

      parent.removeChild(child) // detach from parent
      expect(child.parent).toBeNull()
      expect(child.index).toBe(cIdx) // node still exists
      expect(graph.type[cIdx]).toBe(NodeType.RECTANGLE)
    })

    it('delete should remove node from graph', () => {
      const idx = graph.createNode(NodeType.RECTANGLE, 'test:r')
      const cursor = new NodeCursor(graph, idx)
      cursor.delete()
      expect(() => cursor.type).toThrow('Accessing dead node')
    })

    it('should navigate to parent', () => {
      const p = graph.createNode(NodeType.GROUP, 'test:p')
      const c = graph.createNode(NodeType.RECTANGLE, 'test:c')
      graph.appendChild(p, c)
      const child = new NodeCursor(graph, c)
      expect(child.parent?.index).toBe(p)

      const orphan = new NodeCursor(graph, p)
      expect(orphan.parent).toBeNull()
    })

    it('children iteration with non-flyweight', () => {
      const p = graph.createNode(NodeType.GROUP, 'test:p')
      const c1 = graph.createNode(NodeType.RECTANGLE, 'test:c1')
      const c2 = graph.createNode(NodeType.RECTANGLE, 'test:c2')
      const parent = new NodeCursor(graph, p)
      graph.appendChild(p, c1)
      graph.appendChild(p, c2)

      const children = Array.from(parent.children(false))
      expect(children).toHaveLength(2)
      expect(children[0].index).toBe(c1)
      expect(children[1].index).toBe(c2)
      expect(children[0]).not.toBe(children[1])
    })

    it('children iteration with flyweight', () => {
      const p = graph.createNode(NodeType.GROUP, 'test:p')
      const c1 = graph.createNode(NodeType.RECTANGLE, 'test:c1')
      const c2 = graph.createNode(NodeType.RECTANGLE, 'test:c2')
      const parent = new NodeCursor(graph, p)
      graph.appendChild(p, c1)
      graph.appendChild(p, c2)

      const children = Array.from(parent.children(true))
      expect(children).toHaveLength(2)
      expect(children[0].index).toBe(c2) // flyweight scratch is reused
      expect(children[1].index).toBe(c2)
      expect(children[0]).toBe(children[1])
    })

    it('should detect tree cycles in children iteration', () => {
      const parent = graph.createNode(NodeType.FRAME, 'test:p')
      const c1 = graph.createNode(NodeType.RECTANGLE, 'test:c1')
      const cursor = new NodeCursor(graph, parent)
      graph.appendChild(parent, c1)

      // Force a cycle in siblings
      graph.nextSibling[c1] = c1

      expect(() => Array.from(cursor.children(true))).toThrow(
        'Tree cycle detected'
      )
      expect(() => Array.from(cursor.children(false))).toThrow(
        'Tree cycle detected'
      )
    })
  })

  describe('Transform and Style', () => {
    it('x, y, width, height getters/setters', () => {
      const idx = graph.createNode(NodeType.RECTANGLE, 'test:r1')
      const cursor = new NodeCursor(graph, idx)

      cursor.x = 100
      cursor.y = 200
      cursor.width = 300
      cursor.height = 400
      expect(cursor.x).toBe(100)
      expect(cursor.y).toBe(200)
      expect(cursor.width).toBe(300)
      expect(cursor.height).toBe(400)
    })

    it('resetTransform should reset matrix to identity', () => {
      const idx = graph.createNode(NodeType.RECTANGLE, 'test:r1')
      const cursor = new NodeCursor(graph, idx)

      cursor.transform = [2, 0, 0, 2, 10, 10]
      cursor.resetTransform()
      expect(cursor.transform).toEqual(new Float32Array([1, 0, 0, 1, 0, 0]))
    })

    it('fills getter/setter', () => {
      const idx = graph.createNode(NodeType.RECTANGLE, 'test:r1')
      const cursor = new NodeCursor(graph, idx)
      const fills = [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          visible: true,
          opacity: 1,
          blendMode: BlendModeType.NORMAL,
        },
      ]

      cursor.fills = fills as IPaint[]
      expect(cursor.fills).toEqual(fills)
    })

    it('should handle stroke properties', () => {
      const idx = graph.createNode(NodeType.RECTANGLE, 'test:r')
      const cursor = new NodeCursor(graph, idx)
      cursor.strokeWeight = 5
      expect(cursor.strokeWeight).toBe(5)

      cursor.strokeAlign = 'INSIDE'
      expect(cursor.strokeAlign).toBe('INSIDE')

      cursor.strokeJoin = 'ROUND'
      expect(cursor.strokeJoin).toBe('ROUND')

      cursor.strokeStyle = 'DASH'
      expect(cursor.strokeStyle).toBe('DASH')

      cursor.dashCap = 'ROUND'
      expect(cursor.dashCap).toBe('ROUND')
    })
  })
})
