import { NodeCursor, NULL_INDEX, type SceneGraph } from '@latte-js/espresso'
import { Emitter } from '@latte-js/kit'

import type { IDType } from '@latte-js/bean'

export class SelectionService {
  private _selectChange = new Emitter<IDType[]>()
  public readonly onSelectChange = this._selectChange.event
  private _selectedIds = new Set<IDType>()
  private _activeId: IDType | null = null
  private _anchorId: IDType | null = null
  private _selectionVersion = 0

  constructor(private _sceneGraph: SceneGraph) {}

  setGraph(graph: SceneGraph) {
    if (this._sceneGraph === graph) {
      return
    }
    this._sceneGraph = graph
    this.clear()
  }

  select(ids: readonly IDType[]) {
    this._selectedIds.clear()
    ids.forEach(id => this._selectedIds.add(id))
    this._activeId = ids[ids.length - 1] ?? null
    this._anchorId = ids[0] ?? null
    this._fireChange()
  }

  clear() {
    if (this._selectedIds.size === 0) {
      return
    }
    this._selectedIds.clear()
    this._activeId = null
    this._anchorId = null
    this._fireChange()
  }

  toggle(id: IDType) {
    if (this._selectedIds.has(id)) {
      this._selectedIds.delete(id)
      if (this._activeId === id) {
        this._activeId = Array.from(this._selectedIds).at(-1) ?? null
      }
      if (this._anchorId === id) {
        this._anchorId = this._selectedIds.values().next().value ?? null
      }
    } else {
      this._selectedIds.add(id)
      this._activeId = id
      this._anchorId ??= id
    }
    this._fireChange()
  }

  has(id: IDType): boolean {
    return this._selectedIds.has(id)
  }

  get ids(): IDType[] {
    return Array.from(this._selectedIds)
  }

  get indices(): number[] {
    const indices: number[] = []
    for (const id of this._selectedIds) {
      const index = this._sceneGraph.getIndex(id)
      if (index !== NULL_INDEX) {
        indices.push(index)
      }
    }
    return indices
  }

  get activeId(): IDType | null {
    return this._activeId
  }

  get anchorId(): IDType | null {
    return this._anchorId
  }

  get isEmpty(): boolean {
    return this._selectedIds.size === 0
  }

  get selectionVersion(): number {
    return this._selectionVersion
  }

  forEach(fn: (cursor: NodeCursor) => void) {
    const cursor = new NodeCursor(this._sceneGraph, 0)
    for (const index of this.indices) {
      cursor.to(index)
      fn(cursor)
    }
  }

  map<T>(fn: (cursor: NodeCursor) => T): T[] {
    const result: T[] = []
    const cursor = new NodeCursor(this._sceneGraph, 0)
    for (const index of this.indices) {
      cursor.to(index)
      result.push(fn(cursor))
    }
    return result
  }

  private _fireChange() {
    this._selectionVersion += 1
    this._selectChange.fire(this.ids)
  }
}
