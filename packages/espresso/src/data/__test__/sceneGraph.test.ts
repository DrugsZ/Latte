import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NodeType } from '@latte-js/bean'
import type { IMutationObserver } from '../sceneGraph'
import { SceneGraph } from '../sceneGraph'
import {
  MAX_NODES,
  NULL_INDEX,
  MAT_SIZE,
  MAT_A,
  MAT_D,
  DIRTY_STRUCTURE,
} from '../config'

describe('SceneGraph', () => {
  let sceneGraph: SceneGraph

  beforeEach(() => {
    sceneGraph = new SceneGraph()
  })

  describe('constructor', () => {
    it('should create a new SceneGraph with fresh buffer', () => {
      expect(sceneGraph.buffer).toBeInstanceOf(SharedArrayBuffer)
      expect(sceneGraph.buffer.byteLength).toBeGreaterThan(0)
    })

    it('should initialize memory with NULL_INDEX values', () => {
      const newGraph = new SceneGraph()
      expect(newGraph.parent[1]).toBe(NULL_INDEX)
      expect(newGraph.firstChild[1]).toBe(NULL_INDEX)
      expect(newGraph.nextSibling[1]).toBe(NULL_INDEX)
      expect(newGraph.prevSibling[1]).toBe(NULL_INDEX)
      expect(newGraph.lastChild[1]).toBe(NULL_INDEX)
    })

    it('should initialize identity matrix values', () => {
      const newGraph = new SceneGraph()
      const base = 1 * MAT_SIZE
      expect(newGraph.matrix[base + MAT_A]).toBe(1)
      expect(newGraph.matrix[base + MAT_D]).toBe(1)
    })

    it('should accept existing SharedArrayBuffer', () => {
      const existingBuffer = sceneGraph.buffer
      const newGraph = new SceneGraph(existingBuffer)
      expect(newGraph.buffer).toBe(existingBuffer)
    })

    it('should throw error if buffer size mismatches', () => {
      const wrongBuffer = new SharedArrayBuffer(100)
      expect(() => new SceneGraph(wrongBuffer)).toThrow('Buffer size mismatch')
    })

    it('should create root document node on host initialization', () => {
      const newGraph = new SceneGraph()
      expect(newGraph.type[0]).toBe(NodeType.DOCUMENT)
    })
  })

  describe('createNode', () => {
    it('should create a node and return its index', () => {
      const index = sceneGraph.createNode(NodeType.FRAME, 'frame-1')
      expect(index).toBeGreaterThan(0)
      expect(index).toBeLessThan(MAX_NODES)
    })

    it('should set correct node type', () => {
      const index = sceneGraph.createNode(NodeType.GROUP, 'group-1')
      expect(sceneGraph.type[index]).toBe(NodeType.GROUP)
    })

    it('should initialize node memory correctly', () => {
      const index = sceneGraph.createNode(NodeType.FRAME, 'frame-1')
      expect(sceneGraph.visible[index]).toBe(1)
      expect(sceneGraph.opacity[index]).toBe(1.0)
      expect(sceneGraph.parent[index]).toBe(NULL_INDEX)
      expect(sceneGraph.firstChild[index]).toBe(NULL_INDEX)
      expect(sceneGraph.textPtr[index]).toBe(NULL_INDEX)
    })

    it('should store uuid mappings', () => {
      const uuid = 'test-uuid-123'
      const index = sceneGraph.createNode(NodeType.FRAME, uuid)
      expect(sceneGraph.getIndex(uuid)).toBe(index)
      expect(sceneGraph.getUUID(index)).toBe(uuid)
    })

    it('should set identity matrix for new node', () => {
      const index = sceneGraph.createNode(NodeType.FRAME, 'frame-1')
      const m = index * MAT_SIZE
      expect(sceneGraph.matrix[m + MAT_A]).toBe(1)
      expect(sceneGraph.matrix[m + MAT_D]).toBe(1)
    })

    it('should initialize size to zero', () => {
      const index = sceneGraph.createNode(NodeType.FRAME, 'frame-1')
      expect(sceneGraph.size[index * 2]).toBe(0)
      expect(sceneGraph.size[index * 2 + 1]).toBe(0)
    })
  })

  describe('appendChild', () => {
    let parentIndex: number
    let childIndex: number

    beforeEach(() => {
      parentIndex = sceneGraph.createNode(NodeType.GROUP, 'parent')
      childIndex = sceneGraph.createNode(NodeType.FRAME, 'child')
    })

    it('should append child to parent', () => {
      sceneGraph.appendChild(parentIndex, childIndex)
      expect(sceneGraph.parent[childIndex]).toBe(parentIndex)
      expect(sceneGraph.firstChild[parentIndex]).toBe(childIndex)
      expect(sceneGraph.lastChild[parentIndex]).toBe(childIndex)
    })

    it('should set correct sibling pointers for first child', () => {
      sceneGraph.appendChild(parentIndex, childIndex)
      expect(sceneGraph.prevSibling[childIndex]).toBe(NULL_INDEX)
      expect(sceneGraph.nextSibling[childIndex]).toBe(NULL_INDEX)
    })

    it('should append multiple children correctly', () => {
      const child2Index = sceneGraph.createNode(NodeType.FRAME, 'child2')
      const child3Index = sceneGraph.createNode(NodeType.FRAME, 'child3')

      sceneGraph.appendChild(parentIndex, childIndex)
      sceneGraph.appendChild(parentIndex, child2Index)
      sceneGraph.appendChild(parentIndex, child3Index)

      expect(sceneGraph.firstChild[parentIndex]).toBe(childIndex)
      expect(sceneGraph.lastChild[parentIndex]).toBe(child3Index)
      expect(sceneGraph.nextSibling[childIndex]).toBe(child2Index)
      expect(sceneGraph.prevSibling[child2Index]).toBe(childIndex)
      expect(sceneGraph.nextSibling[child2Index]).toBe(child3Index)
      expect(sceneGraph.prevSibling[child3Index]).toBe(child2Index)
    })

    it('should detach child from old parent before appending', () => {
      const parent2Index = sceneGraph.createNode(NodeType.GROUP, 'parent2')
      sceneGraph.appendChild(parentIndex, childIndex)
      sceneGraph.appendChild(parent2Index, childIndex)

      expect(sceneGraph.parent[childIndex]).toBe(parent2Index)
      expect(sceneGraph.firstChild[parentIndex]).toBe(NULL_INDEX)
      expect(sceneGraph.lastChild[parentIndex]).toBe(NULL_INDEX)
    })

    it('should throw error when appending node to itself', () => {
      expect(() => sceneGraph.appendChild(parentIndex, parentIndex)).toThrow(
        'Cycle: Append self'
      )
    })
  })

  describe('insertAfter', () => {
    let parentIndex: number
    let child1Index: number
    let child2Index: number
    let child3Index: number

    beforeEach(() => {
      parentIndex = sceneGraph.createNode(NodeType.GROUP, 'parent')
      child1Index = sceneGraph.createNode(NodeType.FRAME, 'child1')
      child2Index = sceneGraph.createNode(NodeType.FRAME, 'child2')
      child3Index = sceneGraph.createNode(NodeType.FRAME, 'child3')

      sceneGraph.appendChild(parentIndex, child1Index)
      sceneGraph.appendChild(parentIndex, child3Index)
    })

    it('should insert child after reference node', () => {
      sceneGraph.insertAfter(parentIndex, child2Index, child1Index)

      expect(sceneGraph.nextSibling[child1Index]).toBe(child2Index)
      expect(sceneGraph.prevSibling[child2Index]).toBe(child1Index)
      expect(sceneGraph.nextSibling[child2Index]).toBe(child3Index)
      expect(sceneGraph.prevSibling[child3Index]).toBe(child2Index)
    })

    it('should update lastChild when inserting at end', () => {
      const child4Index = sceneGraph.createNode(NodeType.FRAME, 'child4')
      sceneGraph.insertAfter(parentIndex, child4Index, child3Index)

      expect(sceneGraph.lastChild[parentIndex]).toBe(child4Index)
    })

    it('should detach child from old parent before inserting', () => {
      const parent2Index = sceneGraph.createNode(NodeType.GROUP, 'parent2')
      sceneGraph.appendChild(parent2Index, child2Index)
      sceneGraph.insertAfter(parentIndex, child2Index, child1Index)

      expect(sceneGraph.parent[child2Index]).toBe(parentIndex)
      expect(sceneGraph.nextSibling[child1Index]).toBe(child2Index)
    })
  })

  describe('detach', () => {
    let parentIndex: number
    let child1Index: number
    let child2Index: number
    let child3Index: number

    beforeEach(() => {
      parentIndex = sceneGraph.createNode(NodeType.GROUP, 'parent')
      child1Index = sceneGraph.createNode(NodeType.FRAME, 'child1')
      child2Index = sceneGraph.createNode(NodeType.FRAME, 'child2')
      child3Index = sceneGraph.createNode(NodeType.FRAME, 'child3')

      sceneGraph.appendChild(parentIndex, child1Index)
      sceneGraph.appendChild(parentIndex, child2Index)
      sceneGraph.appendChild(parentIndex, child3Index)
    })

    it('should detach first child correctly', () => {
      sceneGraph.detach(child1Index)

      expect(sceneGraph.parent[child1Index]).toBe(NULL_INDEX)
      expect(sceneGraph.firstChild[parentIndex]).toBe(child2Index)
      expect(sceneGraph.prevSibling[child2Index]).toBe(NULL_INDEX)
    })

    it('should detach middle child correctly', () => {
      sceneGraph.detach(child2Index)

      expect(sceneGraph.nextSibling[child1Index]).toBe(child3Index)
      expect(sceneGraph.prevSibling[child3Index]).toBe(child1Index)
    })

    it('should detach last child correctly', () => {
      sceneGraph.detach(child3Index)

      expect(sceneGraph.parent[child3Index]).toBe(NULL_INDEX)
      expect(sceneGraph.lastChild[parentIndex]).toBe(child2Index)
      expect(sceneGraph.nextSibling[child2Index]).toBe(NULL_INDEX)
    })

    it('should reset sibling pointers', () => {
      sceneGraph.detach(child2Index)

      expect(sceneGraph.prevSibling[child2Index]).toBe(NULL_INDEX)
      expect(sceneGraph.nextSibling[child2Index]).toBe(NULL_INDEX)
    })
  })

  describe('deleteNode', () => {
    let parentIndex: number
    let childIndex: number

    beforeEach(() => {
      parentIndex = sceneGraph.createNode(NodeType.GROUP, 'parent')
      childIndex = sceneGraph.createNode(NodeType.FRAME, 'child')
      sceneGraph.appendChild(parentIndex, childIndex)
    })

    it('should delete node and detach from parent', () => {
      sceneGraph.deleteNode(childIndex)

      expect(sceneGraph.firstChild[parentIndex]).toBe(NULL_INDEX)
      expect(sceneGraph.parent[childIndex]).toBe(NULL_INDEX)
    })

    it('should remove uuid mappings', () => {
      const uuid = 'test-node'
      const index = sceneGraph.createNode(NodeType.FRAME, uuid)
      sceneGraph.deleteNode(index)

      expect(sceneGraph.getIndex(uuid)).toBe(NULL_INDEX)
      expect(sceneGraph.getUUID(index)).toBe('')
    })

    it('should remove from name map', () => {
      const index = sceneGraph.createNode(NodeType.FRAME, 'node')
      sceneGraph.nameMap.set(index, 'CustomName')
      sceneGraph.deleteNode(index)

      expect(sceneGraph.nameMap.has(index)).toBe(false)
    })
  })

  describe('setObserver and markDirty', () => {
    it('should set observer', () => {
      const newObserver: IMutationObserver = {
        onDirty: vi.fn(),
      }
      sceneGraph.setObserver(newObserver)

      const childIndex = sceneGraph.createNode(NodeType.FRAME, 'child')
      const parentIndex = sceneGraph.createNode(NodeType.GROUP, 'parent')
      sceneGraph.appendChild(parentIndex, childIndex)

      expect(newObserver.onDirty).toHaveBeenCalled()
    })
    it('should use default no-op observer if none set', () => {
      const newGraph = new SceneGraph()
      const childIndex = newGraph.createNode(NodeType.FRAME, 'child')
      const parentIndex = newGraph.createNode(NodeType.GROUP, 'parent')

      expect(() => {
        newGraph.appendChild(parentIndex, childIndex)
      }).not.toThrow()
    })
  })

  describe('getIndex and getUUID', () => {
    it('should retrieve node index by uuid', () => {
      const uuid = 'unique-node-id'
      const index = sceneGraph.createNode(NodeType.FRAME, uuid)

      expect(sceneGraph.getIndex(uuid)).toBe(index)
    })

    it('should retrieve uuid by node index', () => {
      const uuid = 'unique-node-id'
      const index = sceneGraph.createNode(NodeType.FRAME, uuid)

      expect(sceneGraph.getUUID(index)).toBe(uuid)
    })

    it('should return NULL_INDEX for non-existent uuid', () => {
      expect(sceneGraph.getIndex('non-existent')).toBe(NULL_INDEX)
    })

    it('should return empty string for non-existent index', () => {
      expect(sceneGraph.getUUID(9999)).toBe('')
    })
  })

  describe('nameMap', () => {
    it('should store and retrieve node names', () => {
      const index = sceneGraph.createNode(NodeType.FRAME, 'frame-1')
      sceneGraph.nameMap.set(index, 'MyFrame')

      expect(sceneGraph.nameMap.get(index)).toBe('MyFrame')
    })

    it('should clear name when node is deleted', () => {
      const index = sceneGraph.createNode(NodeType.FRAME, 'frame-1')
      sceneGraph.nameMap.set(index, 'MyFrame')
      sceneGraph.deleteNode(index)

      expect(sceneGraph.nameMap.has(index)).toBe(false)
    })
  })

  describe('complex hierarchy operations', () => {
    it('should build multi-level hierarchy', () => {
      const root = sceneGraph.createNode(NodeType.DOCUMENT, 'root')
      const group1 = sceneGraph.createNode(NodeType.GROUP, 'group1')
      const group2 = sceneGraph.createNode(NodeType.GROUP, 'group2')
      const frame1 = sceneGraph.createNode(NodeType.FRAME, 'frame1')
      const frame2 = sceneGraph.createNode(NodeType.FRAME, 'frame2')

      sceneGraph.appendChild(root, group1)
      sceneGraph.appendChild(root, group2)
      sceneGraph.appendChild(group1, frame1)
      sceneGraph.appendChild(group2, frame2)

      expect(sceneGraph.parent[group1]).toBe(root)
      expect(sceneGraph.parent[group2]).toBe(root)
      expect(sceneGraph.parent[frame1]).toBe(group1)
      expect(sceneGraph.parent[frame2]).toBe(group2)
      expect(sceneGraph.firstChild[root]).toBe(group1)
      expect(sceneGraph.nextSibling[group1]).toBe(group2)
    })

    it('should move subtree between parents', () => {
      const parent1 = sceneGraph.createNode(NodeType.GROUP, 'parent1')
      const parent2 = sceneGraph.createNode(NodeType.GROUP, 'parent2')
      const child = sceneGraph.createNode(NodeType.FRAME, 'child')
      const grandChild = sceneGraph.createNode(NodeType.FRAME, 'grandchild')

      sceneGraph.appendChild(parent1, child)
      sceneGraph.appendChild(child, grandChild)

      sceneGraph.detach(child)
      sceneGraph.appendChild(parent2, child)

      expect(sceneGraph.parent[child]).toBe(parent2)
      expect(sceneGraph.parent[grandChild]).toBe(child)
      expect(sceneGraph.firstChild[parent2]).toBe(child)
      expect(sceneGraph.firstChild[parent1]).toBe(NULL_INDEX)
    })
  })
})
