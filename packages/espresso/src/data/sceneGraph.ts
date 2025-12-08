// packages/espresso/src/data/SceneGraph.ts
import { NodeType } from '@latte-js/bean'
import { Allocator } from './allocator'
import {
  MAX_NODES,
  NULL_INDEX,
  MAT_SIZE,
  MAT_A,
  MAT_D,
  DIRTY_STRUCTURE,
} from './config'

// 变更观察者接口 (解耦)
export interface IMutationObserver {
  onDirty(index: number, flag: number): void
}

export class SceneGraph {
  // --- 组件组合 ---
  public readonly allocator = new Allocator()
  private _observer: IMutationObserver = { onDirty: () => {} } // 默认空实现

  // --- A. 物理内存 (SharedArrayBuffer) ---

  // 拓扑结构 (Int32, 4 bytes)
  // LCRS 双向链表 + 尾指针优化
  public readonly parent = new Int32Array(new SharedArrayBuffer(MAX_NODES * 4))
  public readonly firstChild = new Int32Array(
    new SharedArrayBuffer(MAX_NODES * 4)
  )
  public readonly nextSibling = new Int32Array(
    new SharedArrayBuffer(MAX_NODES * 4)
  )
  public readonly prevSibling = new Int32Array(
    new SharedArrayBuffer(MAX_NODES * 4)
  )
  public readonly lastChild = new Int32Array(
    new SharedArrayBuffer(MAX_NODES * 4)
  )
  public readonly matrix = new Float32Array(
    new SharedArrayBuffer(MAX_NODES * MAT_SIZE * 4)
  )
  public readonly size = new Float32Array(
    new SharedArrayBuffer(MAX_NODES * 2 * 4)
  )

  public readonly type = new Uint8Array(new SharedArrayBuffer(MAX_NODES))
  public readonly visible = new Uint8Array(new SharedArrayBuffer(MAX_NODES))
  public readonly opacity = new Float32Array(
    new SharedArrayBuffer(MAX_NODES * 4)
  )
  public readonly textPtr = new Int32Array(new SharedArrayBuffer(MAX_NODES * 4))

  private _uuidToIndex = new Map<string, number>()
  private _indexToUuid = new Map<number, string>()
  public nameMap = new Map<number, string>()

  constructor() {
    this.parent.fill(NULL_INDEX)
    this.firstChild.fill(NULL_INDEX)
    this.nextSibling.fill(NULL_INDEX)
    this.prevSibling.fill(NULL_INDEX)
    this.lastChild.fill(NULL_INDEX)
    this.textPtr.fill(NULL_INDEX)

    this.createNode(NodeType.DOCUMENT, 'root')
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

  /**
   * 将 child 挂载到 parent 的末尾
   */
  public appendChild(parent: number, child: number) {
    if (parent === child) throw new Error('Cycle: Append self')

    // 1. 确保 child 干净
    if (this.parent[child] !== NULL_INDEX) {
      this.detach(child)
    }

    // 2. 认父
    this.parent[child] = parent

    // 3. 链接兄弟
    const last = this.lastChild[parent]

    if (last !== NULL_INDEX) {
      // 父亲有孩子：挂在老幺后面
      this.nextSibling[last] = child
      this.prevSibling[child] = last
    } else {
      // 父亲没孩子：成为老大
      this.firstChild[parent] = child
      this.prevSibling[child] = NULL_INDEX
    }

    // 4. 更新收尾
    this.nextSibling[child] = NULL_INDEX // 我是新老幺
    this.lastChild[parent] = child // 父亲记住我

    this.markDirty(parent, DIRTY_STRUCTURE)
  }

  /**
   * 将 child 插到 refNode 之后
   */
  public insertAfter(parent: number, child: number, refNode: number) {
    if (this.parent[child] !== NULL_INDEX) this.detach(child)

    this.parent[child] = parent

    const next = this.nextSibling[refNode] // ref 的弟弟

    // 1. 链接 ref -> child
    this.nextSibling[refNode] = child
    this.prevSibling[child] = refNode

    // 2. 链接 child -> next
    this.nextSibling[child] = next

    if (next !== NULL_INDEX) {
      this.prevSibling[next] = child
    } else {
      // 后面没人了，说明 child 成了新老幺
      this.lastChild[parent] = child
    }

    this.markDirty(parent, DIRTY_STRUCTURE)
  }

  /**
   * 摘除节点 (保持孤儿状态)
   */
  public detach(child: number) {
    const parent = this.parent[child]
    if (parent === NULL_INDEX) return

    const prev = this.prevSibling[child]
    const next = this.nextSibling[child]

    // 1. 修复前驱
    if (prev !== NULL_INDEX) {
      this.nextSibling[prev] = next
    } else {
      // 我是老大，父亲的 firstChild 要指向我的弟弟
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
    this.textPtr[i] = NULL_INDEX

    const m = i * MAT_SIZE
    this.matrix.fill(0, m, m + 6)
    this.matrix[m + MAT_A] = 1
    this.matrix[m + MAT_D] = 1

    // Size Zero
    this.size[i * 2] = 0
    this.size[i * 2 + 1] = 0
  }
}
