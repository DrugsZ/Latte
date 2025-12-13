import { NodeType, StrokeAlign } from '@latte-js/bean'
import { Allocator } from './allocator'
import {
  MAX_NODES,
  NULL_INDEX,
  MAT_A,
  MAT_D,
  DIRTY_STRUCTURE,
  MAT_SIZE,
} from './config'
import { TOTAL_MEMORY_BYTES, LAYOUT_DEF } from './memoryLayout'

export interface IMutationObserver {
  onDirty(index: number, flag: number): void
}

export class SceneGraph {
  public readonly buffer: SharedArrayBuffer

  public readonly allocator = new Allocator()
  private _observer: IMutationObserver = { onDirty: () => {} }

  public readonly parent!: Int32Array
  public readonly firstChild!: Int32Array
  public readonly nextSibling!: Int32Array
  public readonly prevSibling!: Int32Array
  public readonly lastChild!: Int32Array

  public readonly matrix!: Float32Array
  public readonly size!: Float32Array

  public readonly type!: Uint8Array
  public readonly visible!: Uint8Array
  public readonly opacity!: Float32Array
  public readonly textPtr!: Int32Array

  public readonly locked!: Uint8Array

  public readonly strokeWeight!: Int32Array
  public readonly strokeAlign!: Uint8Array

  private _uuidToIndex = new Map<string, number>()
  private _indexToUuid = new Map<number, string>()
  public nameMap = new Map<number, string>()

  constructor(existingBuffer?: SharedArrayBuffer) {
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

    let byteOffset = 0

    for (const item of LAYOUT_DEF) {
      // @ts-expect-error  just close ts error
      this[item.name] = new item.type(this.buffer, byteOffset, item.size)

      byteOffset += item.size * item.type.BYTES_PER_ELEMENT
    }
    if (isHost) {
      this._initMemory()
    }
  }

  private _initMemory() {
    this.parent.fill(NULL_INDEX)
    this.firstChild.fill(NULL_INDEX)
    this.nextSibling.fill(NULL_INDEX)
    this.prevSibling.fill(NULL_INDEX)
    this.lastChild.fill(NULL_INDEX)

    this.visible.fill(1)
    this.opacity.fill(1.0)
    this.locked.fill(0)
    this.textPtr.fill(NULL_INDEX)

    this.strokeWeight.fill(1)
    this.strokeAlign.fill(StrokeAlign.CENTER)
    for (let i = 0; i < MAX_NODES; i++) {
      const base = i * 6
      this.matrix[base + 0] = 1
      this.matrix[base + 3] = 1
    }
    this.type[0] = NodeType.DOCUMENT
  }

  public setObserver(obs: IMutationObserver) {
    this._observer = obs
  }

  public markDirty(index: number, flag: number) {
    this._observer.onDirty(index, flag)
  }

  public createNode(type: NodeType, uuid: string): number {
    const { index } = this.allocator.alloc()

    this._uuidToIndex.set(uuid, index)
    this._indexToUuid.set(index, uuid)

    this._resetMemory(index, type)

    return index
  }

  public deleteNode(index: number) {
    this.detach(index)

    const uuid = this._indexToUuid.get(index)
    if (uuid) this._uuidToIndex.delete(uuid)
    this._indexToUuid.delete(index)
    this.nameMap.delete(index)

    this.allocator.free(index)
  }

  public appendChild(parent: number, child: number) {
    if (parent === child) throw new Error('Cycle: Append self')

    if (this.parent[child] !== NULL_INDEX) {
      this.detach(child)
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

    this.markDirty(parent, DIRTY_STRUCTURE)
  }

  public insertAfter(parent: number, child: number, refNode: number) {
    if (this.parent[child] !== NULL_INDEX) this.detach(child)

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

    this.markDirty(parent, DIRTY_STRUCTURE)
  }

  public detach(child: number) {
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

    this.markDirty(parent, DIRTY_STRUCTURE)
  }

  public getIndex(uuid: string) {
    return this._uuidToIndex.get(uuid) ?? NULL_INDEX
  }
  public getUUID(index: number) {
    return this._indexToUuid.get(index) ?? ''
  }

  private _resetMemory(i: number, type: NodeType) {
    this.type[i] = type
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

    this.locked[i] = 0

    this.strokeWeight[i] = 1
    this.strokeAlign[i] = StrokeAlign.CENTER

    const m = i * MAT_SIZE
    this.matrix.fill(0, m, m + 6)
    this.matrix[m + MAT_A] = 1
    this.matrix[m + MAT_D] = 1

    // Size Zero
    this.size[i * 2] = 0
    this.size[i * 2 + 1] = 0
  }
}
