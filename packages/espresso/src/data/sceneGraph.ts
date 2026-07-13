import { NodeType, StrokeAlign, type IDType } from '@latte-js/bean'

import { Allocator } from './allocator'
import { BlobManager } from './blobManager'
import {
  DIRTY_LOCAL_MATRIX,
  DIRTY_TREE,
  MAT_A,
  MAT_D,
  MAT_SIZE,
  MAX_NODES,
  NODE_LIFECYCLE_ALLOCATED_MASK,
  NodeLifecycle,
  NULL_INDEX,
} from './config'
import { HeapManager } from './heapManager'
import { LAYOUT_DEF, TOTAL_MEMORY_BYTES } from './memoryLayout'
import {
  createSceneGraphMutationAuthority,
  isSceneGraphMutationAuthority,
  type ISceneGraphMutationAuthority,
} from './mutationAuthority'
import { MutationTracker } from './mutationTracker'
import { collectSubtreeIndices } from './treeTraversal'

import type { IMutationRecorder, INodeMutationRecord } from './mutationRecorder'
import { MutationScopeKind, type IMutationScope } from './mutationScope'

export class SceneGraph {
  public readonly tracker = new MutationTracker()

  public readonly buffer: SharedArrayBuffer

  public readonly revision!: Int32Array

  public readonly allocator: Allocator

  public readonly parent!: Int32Array
  public readonly firstChild!: Int32Array
  public readonly nextSibling!: Int32Array
  public readonly prevSibling!: Int32Array
  public readonly lastChild!: Int32Array

  public readonly matrix!: Float32Array
  public readonly worldMatrix!: Float32Array
  public readonly aabb!: Float32Array
  public readonly size!: Float32Array

  public readonly type!: Uint8Array
  public readonly lifecycle!: Uint8Array
  public readonly visible!: Uint8Array
  public readonly opacity!: Float32Array
  public readonly textPtr!: Int32Array
  public readonly namePtr!: Int32Array
  public readonly geometryPtr!: Int32Array
  public readonly fillPtr!: Int32Array
  public readonly strokePtr!: Int32Array

  public readonly locked!: Uint8Array

  public readonly strokeWeight!: Int32Array
  public readonly strokeAlign!: Uint8Array
  public readonly strokeJoin!: Uint8Array
  public readonly strokeStyle!: Uint8Array
  public readonly dashCap!: Uint8Array
  public readonly cornerRadius!: Float32Array

  public readonly blobs: BlobManager
  public readonly heap: HeapManager

  private _uuidToIndex = new Map<IDType, number>()
  private _indexToUuid = new Map<number, IDType>()
  private _tombstoneUuidToIndex = new Map<IDType, number>()
  private _mutationRecorder: IMutationRecorder | null = null
  private _mutationGuardEnabled = false
  private _mutationAuthorities = new WeakSet<object>()
  private _mutationScopes: IMutationScope[] = []
  private _mutationDirtyVersion = 0
  private _mutationRecordVersion = 0

  constructor(
    existingBuffer?: SharedArrayBuffer,
    allocatorBuffer?: SharedArrayBuffer,
    heapBuffer?: SharedArrayBuffer
  ) {
    const isHost = !existingBuffer

    if (existingBuffer) {
      if (existingBuffer.byteLength !== TOTAL_MEMORY_BYTES) {
        throw new Error(
          `[SceneGraph] Buffer size mismatch! Expected ${TOTAL_MEMORY_BYTES}, got ${existingBuffer.byteLength}`
        )
      }
      this.buffer = existingBuffer
    } else {
      this.buffer = new SharedArrayBuffer(TOTAL_MEMORY_BYTES)
    }

    this.allocator = new Allocator(allocatorBuffer)

    let byteOffset = 0

    for (const item of LAYOUT_DEF) {
      // @ts-expect-error  just close ts error
      this[item.name] = new item.type(this.buffer, byteOffset, item.size)

      byteOffset += item.size * item.type.BYTES_PER_ELEMENT
    }
    if (isHost || this._looksUninitialized()) {
      this._initMemory()
    }

    this.heap = new HeapManager(heapBuffer, { resizable: !heapBuffer })
    this.blobs = new BlobManager(this.heap)

    this.tracker.setParentArray(this.parent)
  }

  private _looksUninitialized() {
    return (
      this.parent[0] === 0 &&
      this.firstChild[0] === 0 &&
      this.nextSibling[0] === 0 &&
      this.prevSibling[0] === 0 &&
      this.lastChild[0] === 0
    )
  }

  private _initMemory() {
    this.revision[0] = 0

    this.parent.fill(NULL_INDEX)
    this.firstChild.fill(NULL_INDEX)
    this.nextSibling.fill(NULL_INDEX)
    this.prevSibling.fill(NULL_INDEX)
    this.lastChild.fill(NULL_INDEX)

    this.visible.fill(1)
    this.opacity.fill(1.0)
    this.locked.fill(0)
    this.textPtr.fill(NULL_INDEX)
    this.namePtr.fill(NULL_INDEX)
    this.geometryPtr.fill(NULL_INDEX)
    this.fillPtr.fill(NULL_INDEX)
    this.strokePtr.fill(NULL_INDEX)

    this.lifecycle.fill(NodeLifecycle.Free)
    this.strokeWeight.fill(1)
    this.strokeAlign.fill(StrokeAlign.CENTER)
    this.type[0] = NodeType.DOCUMENT
    this.lifecycle[0] = NodeLifecycle.Active
    this.matrix[MAT_A] = 1
    this.matrix[MAT_D] = 1
    this.worldMatrix[MAT_A] = 1
    this.worldMatrix[MAT_D] = 1
  }

  public dispose() {
    this._mutationRecorder = null
    this._mutationScopes = []
    this.blobs.dispose()
  }

  public get publicationRevision() {
    return Atomics.load(this.revision, 0)
  }

  public get isPublicationWriting() {
    return (this.publicationRevision & 1) === 1
  }

  public beginPublicationWrite() {
    const current = Atomics.load(this.revision, 0)
    if ((current & 1) === 1) {
      return current
    }
    const next = current + 1
    Atomics.store(this.revision, 0, next)
    return next
  }

  public publishRevision() {
    const current = Atomics.load(this.revision, 0)
    const next = (current & 1) === 1 ? current + 1 : current
    Atomics.store(this.revision, 0, next)
    return next
  }

  public readConsistent<T>(reader: () => T): T | null {
    const before = Atomics.load(this.revision, 0)
    if ((before & 1) === 1) {
      return null
    }

    const result = reader()
    const after = Atomics.load(this.revision, 0)
    if (before !== after || (after & 1) === 1) {
      return null
    }

    return result
  }

  public setMutationRecorder(recorder: IMutationRecorder | null) {
    const previous = this._mutationRecorder
    this._mutationRecorder = recorder
    return previous
  }

  public getMutationRecorder() {
    return this._mutationRecorder
  }

  public recordMutation(record: INodeMutationRecord) {
    this.assertMutationAllowed('SceneGraph.recordMutation')
    if (!this._mutationRecorder) {
      return
    }

    this._mutationRecorder.recordMutation(record)
    if (this._shouldAuditHistoryMutation()) {
      this._mutationRecordVersion += 1
    }
  }

  public setMutationGuardEnabled(enabled: boolean) {
    if (this._mutationGuardEnabled && !enabled) {
      throw new Error('[SceneGraph] Mutation guard cannot be disabled')
    }
    this._mutationGuardEnabled = enabled
  }

  public get mutationGuardEnabled() {
    return this._mutationGuardEnabled
  }

  public get activeMutationScope(): IMutationScope | null {
    return this._mutationScopes[this._mutationScopes.length - 1] ?? null
  }

  public createMutationAuthority(owner: string): ISceneGraphMutationAuthority {
    if (this._mutationGuardEnabled) {
      throw new Error(
        `[SceneGraph] Cannot create mutation authority after guard is enabled: ${owner}`
      )
    }
    const authority = createSceneGraphMutationAuthority(owner)
    this._mutationAuthorities.add(authority)
    return authority
  }

  public isNodeIndexAlive(index: number, expectedGeneration?: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= MAX_NODES) {
      return false
    }

    if ((this.lifecycle[index] & NODE_LIFECYCLE_ALLOCATED_MASK) === 0) {
      return false
    }

    if (
      expectedGeneration !== undefined &&
      !this.allocator.isValid(index, expectedGeneration)
    ) {
      return false
    }

    return true
  }

  public isNodeIndexTombstoned(index: number): boolean {
    return (
      Number.isInteger(index) &&
      index >= 0 &&
      index < MAX_NODES &&
      (this.lifecycle[index] & NodeLifecycle.Tombstone) !== 0
    )
  }

  public assertNodeIndexAlive(
    index: number,
    source: string,
    expectedGeneration?: number
  ) {
    if (this.isNodeIndexAlive(index, expectedGeneration)) {
      return
    }

    throw new Error(`[SceneGraph] Invalid node index ${index}: ${source}`)
  }

  public runWithMutationScope<T>(
    authority: ISceneGraphMutationAuthority,
    scope: IMutationScope,
    callback: () => T
  ): T
  public runWithMutationScope<T>(scope: IMutationScope, callback: () => T): T
  public runWithMutationScope<T>(
    authorityOrScope: ISceneGraphMutationAuthority | IMutationScope,
    scopeOrCallback: IMutationScope | (() => T),
    maybeCallback?: () => T
  ): T {
    const hasAuthority = isSceneGraphMutationAuthority(authorityOrScope)
    const authority = hasAuthority ? authorityOrScope : null
    const scope = hasAuthority
      ? (scopeOrCallback as IMutationScope)
      : authorityOrScope
    const callback = hasAuthority ? maybeCallback : (scopeOrCallback as () => T)

    if (!callback) {
      throw new Error('[SceneGraph] Mutation scope callback is required')
    }
    if (this._mutationGuardEnabled) {
      this._assertMutationAuthority(authority, scope.source ?? 'unknown')
    }

    this._mutationScopes.push(scope)
    let popped = false
    const pop = () => {
      if (popped) {
        return
      }
      popped = true
      const current = this._mutationScopes.pop()
      if (current !== scope) {
        throw new Error('[SceneGraph] Mutation scope stack corrupted')
      }
    }

    try {
      const result = callback()
      const maybePromise = result as PromiseLike<unknown> | undefined
      if (maybePromise && typeof maybePromise.then === 'function') {
        return Promise.resolve(result).finally(pop) as T
      }
      pop()
      return result
    } catch (error) {
      pop()
      throw error
    }
  }

  public assertMutationAllowed(source: string) {
    if (!this._mutationGuardEnabled || this._mutationScopes.length > 0) {
      return
    }

    throw new Error(`[SceneGraph] Mutation outside permitted scope: ${source}`)
  }

  public markDirty(index: number, flag: number) {
    this.assertMutationAllowed('SceneGraph.markDirty')
    this.tracker.mark(index, flag)
    if (this._shouldAuditHistoryMutation()) {
      this._mutationDirtyVersion += 1
    }
  }

  public getMutationAuditSnapshot() {
    return {
      dirtyVersion: this._mutationDirtyVersion,
      recordVersion: this._mutationRecordVersion,
    }
  }

  public assertMutationRecordsCovered(
    snapshot: ReturnType<SceneGraph['getMutationAuditSnapshot']>,
    source: string
  ) {
    if (
      this._mutationDirtyVersion !== snapshot.dirtyVersion &&
      this._mutationRecordVersion === snapshot.recordVersion
    ) {
      throw new Error(
        `[SceneGraph] Dirty mutation without history record: ${source}`
      )
    }
  }

  private _shouldAuditHistoryMutation() {
    return (
      this._mutationRecorder !== null &&
      this.activeMutationScope?.kind === MutationScopeKind.History
    )
  }

  private _assertMutationAuthority(
    authority: ISceneGraphMutationAuthority | null,
    source: string
  ) {
    if (authority && this._mutationAuthorities.has(authority)) {
      return
    }

    const owner = authority?.owner ?? 'missing'
    throw new Error(
      `[SceneGraph] Invalid mutation authority for ${source}: ${owner}`
    )
  }

  public registerIdMap(uuid: IDType, index: number) {
    this.assertMutationAllowed('SceneGraph.registerIdMap')
    this.assertNodeIndexAlive(index, 'SceneGraph.registerIdMap')
    const previousIndex = this._uuidToIndex.get(uuid)
    if (previousIndex !== undefined && previousIndex !== index) {
      this._indexToUuid.delete(previousIndex)
    }
    const previousUuid = this._indexToUuid.get(index)
    if (previousUuid !== undefined && previousUuid !== uuid) {
      this._uuidToIndex.delete(previousUuid)
    }
    this._uuidToIndex.set(uuid, index)
    this._indexToUuid.set(index, uuid)
  }

  public unregisterIdMap(uuid: IDType, index: number) {
    this.assertMutationAllowed('SceneGraph.unregisterIdMap')
    if (this._uuidToIndex.get(uuid) === index) {
      this._uuidToIndex.delete(uuid)
    }
    if (this._indexToUuid.get(index) === uuid) {
      this._indexToUuid.delete(index)
    }
  }

  public getUUIDMap() {
    return new Map(this._uuidToIndex)
  }

  public resetUUIDMap(map: Map<IDType, number>) {
    this.assertMutationAllowed('SceneGraph.resetUUIDMap')
    this._uuidToIndex.clear()
    this._indexToUuid.clear()
    for (const [k, v] of map) {
      this._uuidToIndex.set(k, v)
      this._indexToUuid.set(v, k)
    }
  }

  public createNode(type: NodeType, uuid: IDType): number {
    this.assertMutationAllowed('SceneGraph.createNode')
    if (this._uuidToIndex.has(uuid) || this._tombstoneUuidToIndex.has(uuid)) {
      throw new Error(`[SceneGraph] Duplicate node id: ${uuid}`)
    }

    const { index } = this.allocator.alloc()

    this._uuidToIndex.set(uuid, index)
    this._indexToUuid.set(index, uuid)

    this._resetMemory(index, type)
    this._markNodeStructureChanged(index)

    return index
  }

  public deleteNode(index: number) {
    this.assertMutationAllowed('SceneGraph.deleteNode')
    this.assertNodeIndexAlive(index, 'SceneGraph.deleteNode')

    if (index === 0) {
      throw new Error('[SceneGraph] Cannot delete root document node')
    }
    if (this.isNodeIndexTombstoned(index)) {
      return []
    }

    const subtree = collectSubtreeIndices(this, index)
    this._detach(index, { markChildDirty: false })

    const deleted: [id: IDType, index: number][] = []

    for (const nodeIndex of subtree) {
      const uuid = this._indexToUuid.get(nodeIndex)
      if (uuid) {
        deleted.push([uuid, nodeIndex])
        this._uuidToIndex.delete(uuid)
        this._tombstoneUuidToIndex.set(uuid, nodeIndex)
      }
      this.lifecycle[nodeIndex] = NodeLifecycle.Tombstone
    }

    for (const nodeIndex of subtree) {
      this.tracker.clear(nodeIndex)
    }

    return deleted
  }

  public activateTombstoneSubtree(index: number): boolean {
    this.assertMutationAllowed('SceneGraph.activateTombstoneSubtree')
    this.assertNodeIndexAlive(index, 'SceneGraph.activateTombstoneSubtree')

    if (!this.isNodeIndexTombstoned(index)) {
      return false
    }

    const subtree = collectSubtreeIndices(this, index)
    for (const nodeIndex of subtree) {
      const uuid = this._indexToUuid.get(nodeIndex)
      if (!uuid) {
        continue
      }

      const activeIndex = this._uuidToIndex.get(uuid)
      if (activeIndex !== undefined && activeIndex !== nodeIndex) {
        throw new Error(`[SceneGraph] Duplicate node id: ${uuid}`)
      }
    }

    for (const nodeIndex of subtree) {
      const uuid = this._indexToUuid.get(nodeIndex)
      if (uuid) {
        this._tombstoneUuidToIndex.delete(uuid)
        this._uuidToIndex.set(uuid, nodeIndex)
      }
      this.lifecycle[nodeIndex] = NodeLifecycle.Active
      this._markNodeStructureChanged(nodeIndex)
    }
    return true
  }

  public finalizeTombstoneSubtree(index: number) {
    this.assertMutationAllowed('SceneGraph.finalizeTombstoneSubtree')
    this.assertNodeIndexAlive(index, 'SceneGraph.finalizeTombstoneSubtree')
    if (!this.isNodeIndexTombstoned(index)) {
      return
    }

    const subtree = collectSubtreeIndices(this, index)
    for (const nodeIndex of subtree.reverse()) {
      const uuid = this._indexToUuid.get(nodeIndex)
      if (uuid) {
        this._uuidToIndex.delete(uuid)
        this._tombstoneUuidToIndex.delete(uuid)
      }
      this._indexToUuid.delete(nodeIndex)
      this.tracker.clear(nodeIndex)
      this._clearMemory(nodeIndex)
      this.allocator.free(nodeIndex)
    }
  }

  public appendChild(parent: number, child: number) {
    this.assertMutationAllowed('SceneGraph.appendChild')
    this.assertNodeIndexAlive(parent, 'SceneGraph.appendChild parent')
    this.assertNodeIndexAlive(child, 'SceneGraph.appendChild child')
    this._assertNodeNotTombstoned(parent, 'SceneGraph.appendChild parent')
    this._assertNodeNotTombstoned(child, 'SceneGraph.appendChild child')
    if (parent === child) throw new Error('Cycle: Append self')
    this._assertCanReparent(parent, child)

    if (this.parent[child] !== NULL_INDEX) {
      this._detach(child)
    }

    this.parent[child] = parent

    const last = this.lastChild[parent]

    if (last !== NULL_INDEX) {
      this.nextSibling[last] = child
      this.prevSibling[child] = last
    } else {
      this.firstChild[parent] = child
      this.prevSibling[child] = NULL_INDEX
    }

    this.nextSibling[child] = NULL_INDEX
    this.lastChild[parent] = child
    this._markHierarchyChanged(parent, child)
  }

  public insertAfter(parent: number, child: number, refNode: number) {
    this.assertMutationAllowed('SceneGraph.insertAfter')
    this.assertNodeIndexAlive(parent, 'SceneGraph.insertAfter parent')
    this.assertNodeIndexAlive(child, 'SceneGraph.insertAfter child')
    this._assertNodeNotTombstoned(parent, 'SceneGraph.insertAfter parent')
    this._assertNodeNotTombstoned(child, 'SceneGraph.insertAfter child')
    if (parent === child) throw new Error('Cycle: Insert self')
    if (child === refNode) throw new Error('Cycle: Insert after self')
    this._assertCanReparent(parent, child)

    if (refNode === NULL_INDEX) {
      this.appendChild(parent, child)
      return
    }

    this.assertNodeIndexAlive(refNode, 'SceneGraph.insertAfter refNode')
    this._assertNodeNotTombstoned(refNode, 'SceneGraph.insertAfter refNode')
    if (this.parent[refNode] !== parent) {
      throw new Error('[SceneGraph] insertAfter refNode is not child of parent')
    }

    if (this.parent[child] !== NULL_INDEX) this._detach(child)

    this.parent[child] = parent

    const next = this.nextSibling[refNode]

    this.nextSibling[refNode] = child
    this.prevSibling[child] = refNode

    this.nextSibling[child] = next

    if (next !== NULL_INDEX) {
      this.prevSibling[next] = child
    } else {
      this.lastChild[parent] = child
    }
    this._markHierarchyChanged(parent, child)
  }

  public insertChildAt(parent: number, child: number, position: number) {
    this.assertMutationAllowed('SceneGraph.insertChildAt')
    this.assertNodeIndexAlive(parent, 'SceneGraph.insertChildAt parent')
    this.assertNodeIndexAlive(child, 'SceneGraph.insertChildAt child')
    this._assertNodeNotTombstoned(parent, 'SceneGraph.insertChildAt parent')
    this._assertNodeNotTombstoned(child, 'SceneGraph.insertChildAt child')
    if (parent === child) throw new Error('Cycle: Insert self')
    this._assertCanReparent(parent, child)

    const normalizedPosition = Number.isFinite(position)
      ? Math.max(1, Math.floor(position))
      : Number.MAX_SAFE_INTEGER

    if (this.parent[child] !== NULL_INDEX) {
      this._detach(child)
    }

    if (normalizedPosition <= 1 || this.firstChild[parent] === NULL_INDEX) {
      const first = this.firstChild[parent]
      this.parent[child] = parent
      this.prevSibling[child] = NULL_INDEX
      this.nextSibling[child] = first
      this.firstChild[parent] = child
      if (first !== NULL_INDEX) {
        this.prevSibling[first] = child
      } else {
        this.lastChild[parent] = child
      }
      this._markHierarchyChanged(parent, child)
      return
    }

    let refNode = this.firstChild[parent]
    let currentPosition = 1
    while (
      refNode !== NULL_INDEX &&
      this.nextSibling[refNode] !== NULL_INDEX &&
      currentPosition < normalizedPosition - 1
    ) {
      refNode = this.nextSibling[refNode]
      currentPosition += 1
    }

    this.insertAfter(parent, child, refNode)
  }

  public detach(child: number) {
    this.assertMutationAllowed('SceneGraph.detach')
    this.assertNodeIndexAlive(child, 'SceneGraph.detach child')
    this._assertNodeNotTombstoned(child, 'SceneGraph.detach child')
    this._detach(child)
  }

  private _detach(child: number, options: { markChildDirty?: boolean } = {}) {
    const parent = this.parent[child]
    if (parent === NULL_INDEX) return

    const prev = this.prevSibling[child]
    const next = this.nextSibling[child]

    if (prev !== NULL_INDEX) {
      this.nextSibling[prev] = next
    } else {
      this.firstChild[parent] = next
    }

    if (next !== NULL_INDEX) {
      this.prevSibling[next] = prev
    } else {
      this.lastChild[parent] = prev
    }

    this.parent[child] = NULL_INDEX
    this.prevSibling[child] = NULL_INDEX
    this.nextSibling[child] = NULL_INDEX

    this.markDirty(parent, DIRTY_TREE)
    if (options.markChildDirty ?? true) {
      this._markNodeStructureChanged(child)
    }
  }

  public getIndex(uuid: IDType) {
    return this._uuidToIndex.get(uuid) ?? NULL_INDEX
  }
  public getTombstoneIndex(uuid: IDType) {
    return this._tombstoneUuidToIndex.get(uuid) ?? NULL_INDEX
  }
  public getUUID(index: number): IDType | null {
    return this._indexToUuid.get(index) ?? null
  }

  private _assertCanReparent(parent: number, child: number) {
    let current = parent
    let depth = 0

    while (current !== NULL_INDEX) {
      if (current === child) {
        throw new Error('Tree cycle detected')
      }
      if (depth++ > MAX_NODES) {
        throw new Error('Tree cycle detected')
      }
      current = this.parent[current]
    }
  }

  private _assertNodeNotTombstoned(index: number, source: string) {
    if (this.isNodeIndexTombstoned(index)) {
      throw new Error(`[SceneGraph] Tombstoned node cannot be used: ${source}`)
    }
  }

  private _markNodeStructureChanged(index: number) {
    this.markDirty(index, DIRTY_TREE | DIRTY_LOCAL_MATRIX)
  }

  private _markHierarchyChanged(parent: number, child: number) {
    this.markDirty(parent, DIRTY_TREE)
    this.markDirty(child, DIRTY_TREE)
  }

  private _clearMemory(i: number) {
    this._releaseNodeBlobs(i)

    this.type[i] = 0
    this.lifecycle[i] = NodeLifecycle.Free

    this.parent[i] = NULL_INDEX
    this.firstChild[i] = NULL_INDEX
    this.nextSibling[i] = NULL_INDEX
    this.prevSibling[i] = NULL_INDEX
    this.lastChild[i] = NULL_INDEX

    this.visible[i] = 0
    this.opacity[i] = 0
    this.textPtr[i] = NULL_INDEX
    this.namePtr[i] = NULL_INDEX
    this.geometryPtr[i] = NULL_INDEX
    this.fillPtr[i] = NULL_INDEX
    this.strokePtr[i] = NULL_INDEX

    this.locked[i] = 0

    this.strokeWeight[i] = 0
    this.strokeAlign[i] = 0
    this.strokeJoin[i] = 0
    this.strokeStyle[i] = 0
    this.dashCap[i] = 0

    const m = i * MAT_SIZE
    this.matrix.fill(0, m, m + MAT_SIZE)
    this.worldMatrix.fill(0, m, m + MAT_SIZE)
    this.size.fill(0, i * 2, i * 2 + 2)
    this.aabb.fill(0, i * 4, i * 4 + 4)
    this.cornerRadius.fill(0, i * 4, i * 4 + 4)
  }

  private _releaseNodeBlobs(i: number) {
    this.blobs.release(this.textPtr[i])
    this.blobs.release(this.namePtr[i])
    this.blobs.release(this.geometryPtr[i])
    this.blobs.release(this.fillPtr[i])
    this.blobs.release(this.strokePtr[i])
  }

  private _resetMemory(i: number, type: NodeType) {
    this.type[i] = type
    this.lifecycle[i] = NodeLifecycle.Active
    this.visible[i] = 1
    this.opacity[i] = 1.0

    this.parent[i] = NULL_INDEX
    this.firstChild[i] = NULL_INDEX
    this.nextSibling[i] = NULL_INDEX
    this.prevSibling[i] = NULL_INDEX
    this.lastChild[i] = NULL_INDEX

    this.visible[i] = 1
    this.opacity[i] = 1
    this.textPtr[i] = NULL_INDEX
    this.namePtr[i] = NULL_INDEX
    this.geometryPtr[i] = NULL_INDEX
    this.fillPtr[i] = NULL_INDEX
    this.strokePtr[i] = NULL_INDEX

    this.locked[i] = 0

    this.strokeWeight[i] = 1
    this.strokeAlign[i] = StrokeAlign.CENTER

    const m = i * MAT_SIZE
    this.matrix.fill(0, m, m + 6)
    this.matrix[m + MAT_A] = 1
    this.matrix[m + MAT_D] = 1
    this.worldMatrix.fill(0, m, m + 6)
    this.worldMatrix[m + MAT_A] = 1
    this.worldMatrix[m + MAT_D] = 1

    // Size Zero
    this.size[i * 2] = 0
    this.size[i * 2 + 1] = 0
    this.aabb.fill(0, i * 4, i * 4 + 4)
    this.cornerRadius.fill(0, i * 4, i * 4 + 4)
  }
}
