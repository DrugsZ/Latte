import { BlendModeType, FillType, NodeType, StrokeAlign } from '@latte-js/bean'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  DIRTY_TREE,
  MAT_A,
  MAT_D,
  MAT_SIZE,
  NodeLifecycle,
  NULL_INDEX,
} from '../config'
import { MutationScopeKind } from '../mutationScope'
import {
  writeNodeFills,
  writeNodeGeometry,
  writeNodeName,
  writeNodeStrokes,
} from '../nodeProps'
import { SceneGraph } from '../sceneGraph'

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
      expect(newGraph.lifecycle[0]).toBe(NodeLifecycle.Active)
      expect(newGraph.lifecycle[1]).toBe(NodeLifecycle.Free)
    })

    it('should initialize identity matrix values', () => {
      const newGraph = new SceneGraph()
      const base = 0 * MAT_SIZE
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
      expect(secondGraph.getUUID(idx)).toBe(null)
    })

    it('should initialize a blank external SharedArrayBuffer defensively', () => {
      const buffer = new SharedArrayBuffer(sceneGraph.buffer.byteLength)
      const externalGraph = new SceneGraph(buffer)

      expect(externalGraph.parent[0]).toBe(NULL_INDEX)
      expect(externalGraph.firstChild[0]).toBe(NULL_INDEX)
      expect(externalGraph.nextSibling[0]).toBe(NULL_INDEX)
      expect(externalGraph.prevSibling[0]).toBe(NULL_INDEX)
      expect(externalGraph.lastChild[0]).toBe(NULL_INDEX)
      expect(externalGraph.type[0]).toBe(NodeType.DOCUMENT)
    })

    it('should read shared metadata pointers from another graph wrapper', () => {
      const originalGraph = new SceneGraph()
      const idx = originalGraph.createNode(NodeType.RECTANGLE, 'test:r1')
      writeNodeName(originalGraph, idx, 'Shared Rect')
      originalGraph.fillPtr[idx] = originalGraph.blobs.write([
        { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } },
      ])
      writeNodeGeometry(originalGraph, idx, {
        points: [0, 0, 100, 0, 50, 100],
      })

      const secondGraph = new SceneGraph(
        originalGraph.buffer,
        originalGraph.allocator.buffer,
        originalGraph.heap.buffer
      )

      expect(secondGraph.blobs.read(secondGraph.namePtr[idx], true)).toBe(
        'Shared Rect'
      )
      expect(secondGraph.blobs.read(secondGraph.fillPtr[idx])).toEqual([
        { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } },
      ])
      expect(secondGraph.blobs.read(secondGraph.geometryPtr[idx])).toEqual({
        points: [0, 0, 100, 0, 50, 100],
      })
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
      expect(sceneGraph.lifecycle[index]).toBe(NodeLifecycle.Active)
      expect(sceneGraph.getUUID(index)).toBe('test:rect-1')
    })

    it('should tombstone a deleted node and remove its active UUID mapping', () => {
      const index = sceneGraph.createNode(NodeType.RECTANGLE, 'test:rect-1')
      sceneGraph.deleteNode(index)
      expect(sceneGraph.getIndex('test:rect-1')).toBe(NULL_INDEX)
      expect(sceneGraph.getTombstoneIndex('test:rect-1')).toBe(index)
      expect(sceneGraph.isNodeIndexTombstoned(index)).toBe(true)
      expect(sceneGraph.lifecycle[index]).toBe(NodeLifecycle.Tombstone)
      expect(sceneGraph.type[index]).toBe(NodeType.RECTANGLE)
    })

    it('should tombstone a subtree without leaving active child UUID mappings', () => {
      const parent = sceneGraph.createNode(NodeType.GROUP, 'test:parent')
      const child = sceneGraph.createNode(NodeType.RECTANGLE, 'test:child')
      const grandchild = sceneGraph.createNode(
        NodeType.RECTANGLE,
        'test:grandchild'
      )

      sceneGraph.appendChild(parent, child)
      sceneGraph.appendChild(child, grandchild)
      sceneGraph.deleteNode(parent)

      expect(sceneGraph.getIndex('test:parent')).toBe(NULL_INDEX)
      expect(sceneGraph.getIndex('test:child')).toBe(NULL_INDEX)
      expect(sceneGraph.getIndex('test:grandchild')).toBe(NULL_INDEX)
      expect(sceneGraph.isNodeIndexTombstoned(parent)).toBe(true)
      expect(sceneGraph.isNodeIndexTombstoned(child)).toBe(true)
      expect(sceneGraph.isNodeIndexTombstoned(grandchild)).toBe(true)
      expect(sceneGraph.lifecycle[parent]).toBe(NodeLifecycle.Tombstone)
      expect(sceneGraph.lifecycle[child]).toBe(NodeLifecycle.Tombstone)
      expect(sceneGraph.lifecycle[grandchild]).toBe(NodeLifecycle.Tombstone)
    })

    it('should release blob metadata when finalizing a tombstone', () => {
      const index = sceneGraph.createNode(NodeType.RECTANGLE, 'test:rect-blob')
      const textPtr = sceneGraph.blobs.write('Text content')
      sceneGraph.textPtr[index] = textPtr
      const namePtr = writeNodeName(sceneGraph, index, 'Blob Rect')
      const geometryPtr = writeNodeGeometry(sceneGraph, index, {
        points: [0, 0, 10, 10],
      })
      const fillPtr = writeNodeFills(sceneGraph, index, [
        {
          type: FillType.SOLID,
          color: { r: 1, g: 0, b: 0, a: 1 },
          visible: true,
          opacity: 1,
          blendMode: BlendModeType.NORMAL,
        },
      ])
      const strokePtr = writeNodeStrokes(sceneGraph, index, [
        {
          type: FillType.SOLID,
          color: { r: 0, g: 0, b: 1, a: 1 },
          visible: true,
          opacity: 1,
          blendMode: BlendModeType.NORMAL,
        },
      ])

      sceneGraph.deleteNode(index)
      sceneGraph.finalizeTombstoneSubtree(index)

      expect(sceneGraph.blobs.read(textPtr, true)).toBeNull()
      expect(sceneGraph.blobs.read(namePtr, true)).toBeNull()
      expect(sceneGraph.blobs.read(geometryPtr)).toBeNull()
      expect(sceneGraph.blobs.read(fillPtr)).toBeNull()
      expect(sceneGraph.blobs.read(strokePtr)).toBeNull()
      expect(sceneGraph.lifecycle[index]).toBe(NodeLifecycle.Free)
    })

    it('should activate a tombstone subtree without reattaching it', () => {
      const parent = sceneGraph.createNode(NodeType.GROUP, 'test:parent')
      const child = sceneGraph.createNode(NodeType.RECTANGLE, 'test:child')
      sceneGraph.appendChild(parent, child)

      sceneGraph.deleteNode(parent)
      sceneGraph.activateTombstoneSubtree(parent)

      expect(sceneGraph.getIndex('test:parent')).toBe(parent)
      expect(sceneGraph.getIndex('test:child')).toBe(child)
      expect(sceneGraph.lifecycle[parent]).toBe(NodeLifecycle.Active)
      expect(sceneGraph.lifecycle[child]).toBe(NodeLifecycle.Active)
      expect(sceneGraph.parent[parent]).toBe(NULL_INDEX)
      expect(sceneGraph.firstChild[parent]).toBe(child)
    })

    it('should clear dirty entries for deleted subtree indices', () => {
      const parent = sceneGraph.createNode(NodeType.GROUP, 'test:parent')
      const child = sceneGraph.createNode(NodeType.RECTANGLE, 'test:child')
      sceneGraph.appendChild(0, parent)
      sceneGraph.appendChild(parent, child)
      sceneGraph.tracker.flush()

      sceneGraph.markDirty(parent, DIRTY_TREE)
      sceneGraph.markDirty(child, DIRTY_TREE)
      sceneGraph.deleteNode(parent)

      const dirty = sceneGraph.tracker.flush()
      expect(dirty.has(parent)).toBe(false)
      expect(dirty.has(child)).toBe(false)
      expect(dirty.get(0)! & DIRTY_TREE).toBeTruthy()
    })

    it('should reject deleting root document node', () => {
      expect(() => sceneGraph.deleteNode(0)).toThrow(
        'Cannot delete root document node'
      )
    })

    it('should reject duplicate node ids', () => {
      sceneGraph.createNode(NodeType.RECTANGLE, 'test:duplicate')
      expect(() =>
        sceneGraph.createNode(NodeType.RECTANGLE, 'test:duplicate')
      ).toThrow('Duplicate node id')
    })

    it('should handle multiple nodes correctly', () => {
      const idx1 = sceneGraph.createNode(NodeType.RECTANGLE, 'test:rect-1')
      const idx2 = sceneGraph.createNode(NodeType.FRAME, 'test:frame-1')
      expect(idx1).not.toBe(idx2)
      expect(sceneGraph.getIndex('test:rect-1')).toBe(idx1)
      expect(sceneGraph.getIndex('test:frame-1')).toBe(idx2)
    })

    it('should delete node with specific UUID', () => {
      const idx = sceneGraph.createNode(NodeType.RECTANGLE, 'test:empty')
      expect(() => sceneGraph.deleteNode(idx)).not.toThrow()
    })

    it('allows deleteNode in history scope by tombstoning graph state', () => {
      const idx = sceneGraph.createNode(
        NodeType.RECTANGLE,
        'test:history-delete'
      )
      const authority = sceneGraph.createMutationAuthority('test')

      sceneGraph.runWithMutationScope(
        authority,
        { kind: MutationScopeKind.History, source: 'test' },
        () => {
          sceneGraph.deleteNode(idx)
        }
      )

      expect(sceneGraph.getUUID(idx)).toBe('test:history-delete')
      expect(sceneGraph.getIndex('test:history-delete')).toBe(NULL_INDEX)
      expect(sceneGraph.getTombstoneIndex('test:history-delete')).toBe(idx)
      expect(
        sceneGraph.allocator.isValid(idx, sceneGraph.allocator.generations[idx])
      ).toBe(true)
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

    it('should reject insertAfter with refNode from a different parent', () => {
      const p1 = sceneGraph.createNode(NodeType.GROUP, 'test:p1')
      const p2 = sceneGraph.createNode(NodeType.GROUP, 'test:p2')
      const child = sceneGraph.createNode(NodeType.RECTANGLE, 'test:child')
      const ref = sceneGraph.createNode(NodeType.RECTANGLE, 'test:ref')

      sceneGraph.appendChild(p1, ref)

      expect(() => sceneGraph.insertAfter(p2, child, ref)).toThrow(
        'refNode is not child of parent'
      )
      expect(sceneGraph.parent[child]).toBe(NULL_INDEX)
    })

    it('should append when insertAfter receives NULL_INDEX refNode', () => {
      const parent = sceneGraph.createNode(NodeType.GROUP, 'test:p')
      const child = sceneGraph.createNode(NodeType.RECTANGLE, 'test:c')

      sceneGraph.insertAfter(parent, child, NULL_INDEX)

      expect(sceneGraph.parent[child]).toBe(parent)
      expect(sceneGraph.firstChild[parent]).toBe(child)
      expect(sceneGraph.lastChild[parent]).toBe(child)
    })

    it('should reject graph operations with invalid node indices', () => {
      const parent = sceneGraph.createNode(NodeType.GROUP, 'test:p')
      expect(() => sceneGraph.appendChild(parent, 9999)).toThrow(
        'Invalid node index'
      )
      expect(() => sceneGraph.detach(9999)).toThrow('Invalid node index')
    })

    it('rejects guarded structural mutations outside a declared mutation scope', () => {
      const parent = sceneGraph.createNode(NodeType.GROUP, 'test:p')
      const child = sceneGraph.createNode(NodeType.RECTANGLE, 'test:c')
      sceneGraph.appendChild(parent, child)

      sceneGraph.setMutationGuardEnabled(true)

      expect(() =>
        sceneGraph.createNode(NodeType.RECTANGLE, 'test:new')
      ).toThrow('Mutation outside permitted scope')
      expect(() => sceneGraph.detach(child)).toThrow(
        'Mutation outside permitted scope'
      )
      expect(() => sceneGraph.appendChild(parent, child)).toThrow(
        'Mutation outside permitted scope'
      )
      expect(() => sceneGraph.insertAfter(parent, child, NULL_INDEX)).toThrow(
        'Mutation outside permitted scope'
      )
      expect(() => sceneGraph.registerIdMap('test:alias', parent)).toThrow(
        'Mutation outside permitted scope'
      )
      expect(() => sceneGraph.unregisterIdMap('test:p', parent)).toThrow(
        'Mutation outside permitted scope'
      )
      expect(() => sceneGraph.resetUUIDMap(new Map())).toThrow(
        'Mutation outside permitted scope'
      )
    })

    it('rejects mutation scopes without a graph-local authority when guarded', () => {
      sceneGraph.setMutationGuardEnabled(true)

      expect(() =>
        sceneGraph.runWithMutationScope(
          { kind: MutationScopeKind.WriteNoHistory, source: 'test' },
          () => {}
        )
      ).toThrow('Invalid mutation authority')
    })

    it('does not allow mutation guard to be disabled after enabling', () => {
      sceneGraph.setMutationGuardEnabled(true)

      expect(() => sceneGraph.setMutationGuardEnabled(false)).toThrow(
        'Mutation guard cannot be disabled'
      )
    })

    it('does not allow late mutation authority creation after enabling guard', () => {
      sceneGraph.setMutationGuardEnabled(true)

      expect(() => sceneGraph.createMutationAuthority('late')).toThrow(
        'Cannot create mutation authority after guard is enabled'
      )
    })

    it('allows guarded structural mutations inside a declared mutation scope', () => {
      const authority = sceneGraph.createMutationAuthority('test')
      sceneGraph.setMutationGuardEnabled(true)

      sceneGraph.runWithMutationScope(
        authority,
        { kind: MutationScopeKind.WriteNoHistory, source: 'test' },
        () => {
          const parent = sceneGraph.createNode(NodeType.GROUP, 'test:p')
          const child = sceneGraph.createNode(NodeType.RECTANGLE, 'test:c')
          sceneGraph.appendChild(parent, child)
          sceneGraph.detach(child)
          sceneGraph.registerIdMap('test:root-alias', 0)
          sceneGraph.unregisterIdMap('test:root-alias', 0)
        }
      )

      expect(sceneGraph.getIndex('test:p')).not.toBe(NULL_INDEX)
      expect(sceneGraph.getIndex('test:c')).not.toBe(NULL_INDEX)
      expect(sceneGraph.getIndex('test:root-alias')).toBe(NULL_INDEX)
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

    it('should mark hierarchy changes dirty', () => {
      const parent = sceneGraph.createNode(NodeType.FRAME, 'test:p')
      const child = sceneGraph.createNode(NodeType.RECTANGLE, 'test:c')
      sceneGraph.tracker.flush()

      sceneGraph.appendChild(parent, child)

      let dirty = sceneGraph.tracker.flush()
      expect(dirty.get(parent)! & DIRTY_TREE).toBeTruthy()
      expect(dirty.get(child)! & DIRTY_TREE).toBeTruthy()

      sceneGraph.detach(child)

      dirty = sceneGraph.tracker.flush()
      expect(dirty.get(parent)! & DIRTY_TREE).toBeTruthy()
      expect(dirty.get(child)! & DIRTY_TREE).toBeTruthy()
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
      expect(sceneGraph.getIndex('test:non-existent')).toBe(NULL_INDEX)
    })

    it('should return null for non-existent index', () => {
      expect(sceneGraph.getUUID(999)).toBe(null)
    })

    it('should handle re-registering or updating mapping if needed', () => {
      const idx = sceneGraph.createNode(NodeType.RECTANGLE, 'test:uuid1')
      expect(sceneGraph.getUUID(idx)).toBe('test:uuid1')
      expect(sceneGraph.getIndex('test:uuid1')).toBe(idx)
    })

    it('should expose UUID maps as snapshots', () => {
      sceneGraph.createNode(NodeType.RECTANGLE, 'test:uuid1')
      const map = sceneGraph.getUUIDMap()

      map.set('test:external', 42)

      expect(sceneGraph.getIndex('test:external')).toBe(NULL_INDEX)
      expect(sceneGraph.getUUID(42)).toBe(null)
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
