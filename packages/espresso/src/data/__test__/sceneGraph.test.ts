import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { IDType } from '@latte-js/bean'
import { NodeType, StrokeAlign } from '@latte-js/bean'
import { type IGraphObserver } from '../../typing'
import { SceneGraph } from '../sceneGraph'
import { NULL_INDEX, MAT_SIZE, MAT_A, MAT_D } from '../config'

describe('SceneGraph', () => {
  let sceneGraph: SceneGraph

  beforeEach(() => {
    sceneGraph = new SceneGraph()
  })

  describe('constructor', () => {
    it('should create a new SceneGraph with fresh buffer', () => {
      expect(sceneGraph.buffer).toBeInstanceOf(SharedArrayBuffer)
      expect(sceneGraph.buffer.byteLength).toBeGreaterThan(0)
      expect(sceneGraph.blobs).toBeDefined()
      expect(sceneGraph.heap).toBeDefined()
    })

    it('should initialize memory with NULL_INDEX values', () => {
      const newGraph = new SceneGraph()
      expect(newGraph.parent[1]).toBe(NULL_INDEX)
      expect(newGraph.firstChild[1]).toBe(NULL_INDEX)
      expect(newGraph.nextSibling[1]).toBe(NULL_INDEX)
      expect(newGraph.prevSibling[1]).toBe(NULL_INDEX)
      expect(newGraph.lastChild[1]).toBe(NULL_INDEX)
      expect(newGraph.locked[1]).toBe(0)
      expect(newGraph.strokeWeight[1]).toBe(1)
      expect(newGraph.strokeAlign[1]).toBe(StrokeAlign.CENTER)
    })

    it('should initialize identity matrix values', () => {
      const newGraph = new SceneGraph()
      const base = 1 * MAT_SIZE
      expect(newGraph.matrix[base + MAT_A]).toBe(1)
      expect(newGraph.matrix[base + MAT_D]).toBe(1)
    })

    it('should throw error on buffer size mismatch', () => {
      const smallBuffer = new SharedArrayBuffer(1024)
      expect(() => new SceneGraph(smallBuffer)).toThrow('Buffer size mismatch')
    })

    it('should initialize from existing SharedArrayBuffer', () => {
      const originalGraph = new SceneGraph()
      const idx = originalGraph.createNode(NodeType.RECTANGLE, 'test:r1')

      const secondGraph = new SceneGraph(originalGraph.buffer)
      expect(secondGraph.type[idx]).toBe(NodeType.RECTANGLE)
      // UUIDs are not stored in buffer, so this is expectedly empty unless re-registered
      expect(secondGraph.getUUID(idx)).toBe('')
    })

    it('should detach child when appending to a new parent', () => {
      const p1 = sceneGraph.createNode(NodeType.GROUP, 'test:p1')
      const p2 = sceneGraph.createNode(NodeType.GROUP, 'test:p2')
      const c = sceneGraph.createNode(NodeType.RECTANGLE, 'test:c')

      sceneGraph.appendChild(p1, c)
      expect(sceneGraph.parent[c]).toBe(p1)

      sceneGraph.appendChild(p2, c)
      expect(sceneGraph.parent[c]).toBe(p2)
      expect(sceneGraph.firstChild[p1]).toBe(NULL_INDEX)
    })

    it('should update sibling pointers correctly on detach', () => {
      const p = sceneGraph.createNode(NodeType.GROUP, 'test:p')
      const c1 = sceneGraph.createNode(NodeType.RECTANGLE, 'test:c1')
      const c2 = sceneGraph.createNode(NodeType.RECTANGLE, 'test:c2')
      const c3 = sceneGraph.createNode(NodeType.RECTANGLE, 'test:c3')

      sceneGraph.appendChild(p, c1)
      sceneGraph.appendChild(p, c2)
      sceneGraph.appendChild(p, c3)

      // Detach middle child
      sceneGraph.detach(c2)
      expect(sceneGraph.nextSibling[c1]).toBe(c3)
      expect(sceneGraph.prevSibling[c3]).toBe(c1)

      // Detach first child
      sceneGraph.detach(c1)
      expect(sceneGraph.firstChild[p]).toBe(c3)
      expect(sceneGraph.prevSibling[c3]).toBe(NULL_INDEX)

      // Detach last child
      sceneGraph.detach(c3)
      expect(sceneGraph.firstChild[p]).toBe(NULL_INDEX)
      expect(sceneGraph.lastChild[p]).toBe(NULL_INDEX)
    })
  })

  describe('Node Lifecycle', () => {
    it('should create a node and return its index', () => {
      const index = sceneGraph.createNode(NodeType.RECTANGLE, 'test:rect-1')
      expect(index).toBeGreaterThan(0)
      expect(sceneGraph.type[index]).toBe(NodeType.RECTANGLE)
      expect(sceneGraph.getUUID(index)).toBe('test:rect-1')
    })

    it('should delete a node and its UUID mapping', () => {
      const index = sceneGraph.createNode(NodeType.RECTANGLE, 'test:rect-1')
      sceneGraph.deleteNode(index)
      expect(sceneGraph.getIndex('test:rect-1')).toBe(NULL_INDEX)
    })

    it('should handle multiple nodes correctly', () => {
      const idx1 = sceneGraph.createNode(NodeType.RECTANGLE, 'test:rect-1')
      const idx2 = sceneGraph.createNode(NodeType.FRAME, 'test:frame-1')
      expect(idx1).not.toBe(idx2)
      expect(sceneGraph.getIndex('test:rect-1')).toBe(idx1)
      expect(sceneGraph.getIndex('test:frame-1')).toBe(idx2)
    })

    it('should delete node without UUID', () => {
      const idx = sceneGraph.createNode(NodeType.RECTANGLE, '' as IDType)
      expect(() => sceneGraph.deleteNode(idx)).not.toThrow()
    })

    it('should insertAfter node that already has a parent', () => {
      const p1 = sceneGraph.createNode(NodeType.GROUP, 'test:p1')
      const p2 = sceneGraph.createNode(NodeType.GROUP, 'test:p2')
      const c1 = sceneGraph.createNode(NodeType.RECTANGLE, 'test:c1')
      const ref = sceneGraph.createNode(NodeType.RECTANGLE, 'test:ref')
      sceneGraph.appendChild(p2, ref)
      sceneGraph.appendChild(p1, c1)

      sceneGraph.insertAfter(p2, c1, ref)
      expect(sceneGraph.parent[c1]).toBe(p2)
      expect(sceneGraph.nextSibling[ref]).toBe(c1)
      expect(sceneGraph.firstChild[p1]).toBe(NULL_INDEX)
    })
  })

  describe('Hierarchy Operations', () => {
    it('should append child to parent', () => {
      const parent = sceneGraph.createNode(NodeType.GROUP, 'test:p')
      const child = sceneGraph.createNode(NodeType.FRAME, 'test:c')

      sceneGraph.appendChild(parent, child)

      expect(sceneGraph.parent[child]).toBe(parent)
      expect(sceneGraph.firstChild[parent]).toBe(child)
      expect(sceneGraph.lastChild[parent]).toBe(child)
    })

    it('should handle cycle detection on append', () => {
      const node = sceneGraph.createNode(NodeType.FRAME, 'test:node')
      expect(() => sceneGraph.appendChild(node, node)).toThrow(
        'Cycle: Append self'
      )
    })

    it('should insert after reference node', () => {
      const parent = sceneGraph.createNode(NodeType.FRAME, 'test:p')
      const child1 = sceneGraph.createNode(NodeType.RECTANGLE, 'test:c1')
      const child2 = sceneGraph.createNode(NodeType.RECTANGLE, 'test:c2')
      const child3 = sceneGraph.createNode(NodeType.RECTANGLE, 'test:c3')

      sceneGraph.appendChild(parent, child1)
      sceneGraph.appendChild(parent, child3)
      sceneGraph.insertAfter(parent, child2, child1)

      expect(sceneGraph.nextSibling[child1]).toBe(child2)
      expect(sceneGraph.nextSibling[child2]).toBe(child3)
      expect(sceneGraph.prevSibling[child3]).toBe(child2)
    })

    it('should detach node from parent', () => {
      const parent = sceneGraph.createNode(NodeType.FRAME, 'test:p')
      const child = sceneGraph.createNode(NodeType.RECTANGLE, 'test:c')
      sceneGraph.appendChild(parent, child)

      sceneGraph.detach(child)

      expect(sceneGraph.parent[child]).toBe(NULL_INDEX)
      expect(sceneGraph.firstChild[parent]).toBe(NULL_INDEX)
    })
  })

  describe('Observers and Notifications', () => {
    it('should notify observers on change', () => {
      const observer: IGraphObserver = {
        update: vi.fn(),
      }
      sceneGraph.setObserver(observer)

      sceneGraph.notifyObservers('uuid-1', 'name', 'old', 'new')

      expect(observer.update).toHaveBeenCalledWith(
        'uuid-1',
        'name',
        'old',
        'new'
      )
    })

    it('should handle notification without observers', () => {
      const emptyGraph = new SceneGraph()
      expect(() =>
        emptyGraph.notifyObservers('uuid-1', 'name', 'old', 'new')
      ).not.toThrow()
    })

    it('should allow multiple observers', () => {
      const obs1 = { update: vi.fn() }
      const obs2 = { update: vi.fn() }
      sceneGraph.setObserver(obs1)
      sceneGraph.setObserver(obs2)

      sceneGraph.notifyObservers('uuid-1', 'prop', 'v1', 'v2')
      expect(obs1.update).toHaveBeenCalledTimes(1)
      expect(obs2.update).toHaveBeenCalledTimes(1)
    })
  })

  describe('Mutation Tracking', () => {
    it('should mark node as dirty', () => {
      const idx = sceneGraph.createNode(NodeType.RECTANGLE, 'test:r1')
      // markDirty uses internal mutation tracker, we verify it doesn't throw
      // and we could potentially verify its effect if mutationTracker was exposed
      // or if we had a method to check dirty state.
      // For now we check it's callable.
      expect(() => sceneGraph.markDirty(idx, 1)).not.toThrow()
    })
  })

  describe('UUID and Index mapping', () => {
    it('should return NULL_INDEX for non-existent UUID', () => {
      expect(sceneGraph.getIndex('non-existent')).toBe(NULL_INDEX)
    })

    it('should return empty string for non-existent index', () => {
      expect(sceneGraph.getUUID(999)).toBe('')
    })

    it('should handle re-registering or updating mapping if needed', () => {
      const idx = sceneGraph.createNode(NodeType.RECTANGLE, 'test:uuid1')
      expect(sceneGraph.getUUID(idx)).toBe('test:uuid1')
      expect(sceneGraph.getIndex('test:uuid1')).toBe(idx)
    })
  })

  describe('Node Initialization', () => {
    it('should initialize matrix to identity', () => {
      const index = sceneGraph.createNode(NodeType.FRAME, 'test:frame-1')
      const m = index * MAT_SIZE
      expect(sceneGraph.matrix[m + MAT_A]).toBe(1)
      expect(sceneGraph.matrix[m + MAT_D]).toBe(1)
    })

    it('should initialize size to zero', () => {
      const index = sceneGraph.createNode(NodeType.FRAME, 'test:frame-1')
      expect(sceneGraph.size[index * 2]).toBe(0)
      expect(sceneGraph.size[index * 2 + 1]).toBe(0)
    })
  })
})
