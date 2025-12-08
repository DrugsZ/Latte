import { NULL_INDEX } from '../data/config'
import type { SceneGraph } from '../data/sceneGraph'
import { NodeType } from '@latte-js/bean'

const mapType = (typeStr: string): number => {
  return NodeType[typeStr as keyof typeof NodeType] ?? NodeType.GROUP
}

class LatteLoader {
  constructor(private _graph: SceneGraph) {}
  public load(json: LatteFile) {
    const nodes = Object.values(json.nodes)

    // 1. 临时容器：按 ParentID 分组
    // Map<ParentID, Node[]>
    const groups = new Map<string, LatteNode[]>()

    // 临时映射：UUID -> 内存 Index
    const idMap = new Map<string, number>()

    // --- Pass 1: 内存分配 & 分组 ---
    for (const node of nodes) {
      // A. Alloc 内存
      const idx = this._graph.createNode(mapType(node.type), node.id)
      idMap.set(node.id, idx)

      // B. 写入属性 (Box, Style...)
      // ... write to SharedArrayBuffer ...
      // C. 写入 SortOrder 到 Map
      this._graph.sortOrderMap.set(idx, node.sortOrder)

      // D. 放入分组桶
      const pid = node.parent || 'root_parent' // 虚拟根
      if (!groups.has(pid)) groups.set(pid, [])
      groups.get(pid)!.push(node)
    }

    // --- Pass 2: 排序 & 链接 (Link) ---
    for (const [parentIdStr, childrenNodes] of groups) {
      // 如果是虚拟根的父级，跳过或特殊处理
      if (!idMap.has(parentIdStr) && parentIdStr !== 'root_parent') continue

      const parentIdx = idMap.get(parentIdStr) ?? NULL_INDEX

      // A. 排序 (Sort)
      // 根据 sortOrder 字符串字典序排序
      childrenNodes.sort((a, b) => {
        if (a.sortOrder < b.sortOrder) return -1
        if (a.sortOrder > b.sortOrder) return 1
        return 0
      })

      // B. 构建 LCRS 链表
      let prevIdx = NULL_INDEX

      for (let i = 0; i < childrenNodes.length; i++) {
        const childNode = childrenNodes[i]
        const childIdx = idMap.get(childNode.id)!

        // 1. 认父
        if (parentIdx !== NULL_INDEX) {
          this._graph.parent[childIdx] = parentIdx
        }

        // 2. 连兄弟
        if (i === 0) {
          // 我是老大
          if (parentIdx !== NULL_INDEX) {
            this._graph.firstChild[parentIdx] = childIdx
          }
        } else {
          // 连在前一个后面
          this._graph.nextSibling[prevIdx] = childIdx
          this._graph.prevSibling[childIdx] = prevIdx // 双向
        }

        prevIdx = childIdx
      }

      // 3. 记录老幺 (Last Child)
      if (parentIdx !== NULL_INDEX && prevIdx !== NULL_INDEX) {
        this._graph.lastChild[parentIdx] = prevIdx
      }
    }
  }
}
