import { NodeType, type IDType } from '@latte-js/bean'
import {
  MAX_NODES,
  NodeLifecycle,
  NULL_INDEX,
  type SceneGraph,
} from '@latte-js/espresso'
import RBush from 'rbush'

export interface RenderSceneBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface RenderSceneIndexItem extends RenderSceneBounds {
  id: number
  order: number
}

const normalizeBounds = (bounds: RenderSceneBounds): RenderSceneBounds => ({
  minX: Math.min(bounds.minX, bounds.maxX),
  minY: Math.min(bounds.minY, bounds.maxY),
  maxX: Math.max(bounds.minX, bounds.maxX),
  maxY: Math.max(bounds.minY, bounds.maxY),
})

export class RenderSceneIndex {
  private _tree = new RBush<RenderSceneIndexItem>()
  private readonly _items = new Map<number, RenderSceneIndexItem>()
  private readonly _idToIndex = new Map<IDType, number>()
  private readonly _order = new Map<number, number>()
  private readonly _subtreeEnd = new Map<number, number>()

  constructor(private _sceneGraph: SceneGraph) {
    this.rebuild()
  }

  public get tree() {
    return this._tree
  }

  public setGraph(graph: SceneGraph) {
    this._sceneGraph = graph
    this.rebuild()
  }

  public clear() {
    this._tree.clear()
    this._items.clear()
    this._idToIndex.clear()
    this._order.clear()
    this._subtreeEnd.clear()
  }

  public rebuild() {
    this.clear()

    if (!this._isActiveNode(0)) {
      return
    }

    const items: RenderSceneIndexItem[] = []
    const stack: { index: number; phase: 'enter' | 'exit' }[] = [
      { index: 0, phase: 'enter' },
    ]
    const visiting = new Set<number>()
    const visited = new Set<number>()
    let order = 0

    while (stack.length) {
      const current = stack.pop()!
      const { index } = current

      if (current.phase === 'exit') {
        this._subtreeEnd.set(index, order)
        visiting.delete(index)
        continue
      }

      if (!this._isActiveNode(index)) {
        continue
      }
      if (visiting.has(index) || visited.size > MAX_NODES) {
        throw new Error(`Tree cycle detected at node ${index}`)
      }
      if (visited.has(index)) {
        continue
      }

      visiting.add(index)
      visited.add(index)
      this._order.set(index, order)
      const id = this._sceneGraph.getUUID(index)
      if (id) {
        this._idToIndex.set(id, index)
      }

      const item = this._createItem(index, order)
      if (item) {
        this._items.set(index, item)
        items.push(item)
      }
      order += 1

      stack.push({ index, phase: 'exit' })

      const children: number[] = []
      let child = this._sceneGraph.firstChild[index]
      const visitedChildren = new Set<number>()
      while (child !== NULL_INDEX) {
        if (visitedChildren.has(child) || visitedChildren.size > MAX_NODES) {
          throw new Error(`Tree cycle detected at node ${child}`)
        }
        visitedChildren.add(child)
        children.push(child)
        child = this._sceneGraph.nextSibling[child]
      }

      for (let i = children.length - 1; i >= 0; i -= 1) {
        stack.push({ index: children[i], phase: 'enter' })
      }
    }

    if (items.length > 0) {
      this._tree.load(items)
    }
  }

  public updateByIds(ids: Iterable<IDType>) {
    for (const id of ids) {
      const previousIndex = this._idToIndex.get(id)
      if (previousIndex !== undefined) {
        this._removeIndex(previousIndex)
        this._idToIndex.delete(id)
      }

      const index = this._sceneGraph.getIndex(id)
      if (index === NULL_INDEX || !this._isActiveNode(index)) {
        continue
      }
      if (!this._order.has(index)) {
        this.rebuild()
        return
      }

      this._idToIndex.set(id, index)
      const item = this._createItem(index, this._order.get(index)!)
      if (item) {
        this._items.set(index, item)
        this._tree.insert(item)
      }
    }
  }

  public queryViewport(bounds: RenderSceneBounds, rootId?: IDType | null) {
    const rootIndex = this._resolveRootIndex(rootId)
    if (rootIndex === NULL_INDEX) {
      return []
    }

    const normalized = normalizeBounds(bounds)
    return this._filterAndSort(this._tree.search(normalized), rootIndex)
  }

  public queryPoint(x: number, y: number, rootId?: IDType | null) {
    return this.queryViewport({ minX: x, minY: y, maxX: x, maxY: y }, rootId)
  }

  private _resolveRootIndex(rootId?: IDType | null) {
    if (!rootId) {
      return this._isActiveNode(0) ? 0 : NULL_INDEX
    }
    return this._sceneGraph.getIndex(rootId)
  }

  private _filterAndSort(items: RenderSceneIndexItem[], rootIndex: number) {
    const rootOrder = this._order.get(rootIndex)
    const rootEnd = this._subtreeEnd.get(rootIndex)
    if (rootOrder === undefined || rootEnd === undefined) {
      return []
    }

    return items
      .filter(
        item =>
          item.order >= rootOrder &&
          item.order < rootEnd &&
          this._isRenderableInTree(item.id, rootIndex)
      )
      .sort((a, b) => a.order - b.order)
      .map(item => item.id)
  }

  private _isRenderableInTree(index: number, rootIndex: number) {
    let current = index
    const visited = new Set<number>()

    while (current !== NULL_INDEX) {
      if (visited.has(current) || visited.size > MAX_NODES) {
        throw new Error(`Tree cycle detected at node ${current}`)
      }
      visited.add(current)

      if (
        !this._isActiveNode(current) ||
        this._sceneGraph.visible[current] !== 1
      ) {
        return false
      }
      if (current === rootIndex) {
        return true
      }

      current = this._sceneGraph.parent[current]
    }

    return false
  }

  private _removeIndex(index: number) {
    const item = this._items.get(index)
    if (!item) {
      return
    }

    this._tree.remove(item, (a, b) => a.id === b.id)
    this._items.delete(index)
  }

  private _createItem(
    index: number,
    order: number
  ): RenderSceneIndexItem | null {
    const type = this._sceneGraph.type[index]
    if (
      type === NodeType.DOCUMENT ||
      type === NodeType.CANVAS ||
      type === NodeType.GROUP
    ) {
      return null
    }

    const aabbPtr = index * 4
    const minX = this._sceneGraph.aabb[aabbPtr]
    const minY = this._sceneGraph.aabb[aabbPtr + 1]
    const maxX = this._sceneGraph.aabb[aabbPtr + 2]
    const maxY = this._sceneGraph.aabb[aabbPtr + 3]
    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY) ||
      minX > maxX ||
      minY > maxY
    ) {
      return null
    }

    return { minX, minY, maxX, maxY, id: index, order }
  }

  private _isActiveNode(index: number) {
    return (this._sceneGraph.lifecycle[index] & NodeLifecycle.Active) !== 0
  }
}
