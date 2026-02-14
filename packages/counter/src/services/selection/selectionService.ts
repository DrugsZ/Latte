import { NodeCursor, type SceneGraph } from '@latte-js/espresso'
import { Emitter } from '@latte-js/kit'
import type { IDType } from '@latte-js/bean'

export class SelectionService {
  private _selectChange = new Emitter<IDType[]>()
  public readonly onSelectChange = this._selectChange.event
  private _selectedIndices = new Set<IDType>()

  constructor(private readonly _sceneGraph: SceneGraph) {}

  select(indices: IDType[]) {
    this._selectedIndices.clear()
    indices.forEach(i => this._selectedIndices.add(i))
    this._selectChange.fire(this.indices)
  }
  clear() {
    this._selectedIndices.clear()
    this._selectChange.fire(this.indices)
  }
  toggle(index: IDType) {
    if (this._selectedIndices.has(index)) {
      this._selectedIndices.delete(index)
    } else {
      this._selectedIndices.add(index)
    }
    this._selectChange.fire(this.indices)
  }

  get indices() {
    return Array.from(this._selectedIndices)
  }
  get isEmpty(): boolean {
    return this._selectedIndices.size === 0
  }

  forEach(fn: (cursor: NodeCursor) => void) {
    const cursor = new NodeCursor(this._sceneGraph, 0)
    for (const index of this._selectedIndices) {
      cursor.toID(index)
      fn(cursor)
    }
  }

  map<T>(fn: (cursor: NodeCursor) => T): T[] {
    const result: T[] = []
    const cursor = new NodeCursor(this._sceneGraph, 0)
    for (const index of this._selectedIndices) {
      cursor.toID(index)
      result.push(fn(cursor))
    }
    return result
  }
}
