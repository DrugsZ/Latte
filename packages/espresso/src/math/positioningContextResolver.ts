import { NodeType, type IDType } from '@latte-js/bean'

import { MAX_NODES, NULL_INDEX } from '../data/config'

import type { SceneGraph } from '../data/sceneGraph'

export interface PositioningContext {
  readonly targetId: IDType
  readonly directParentId: IDType | null
  readonly containingParentId: IDType | null
}

export interface ResolvedPositioningContext extends PositioningContext {
  readonly targetIndex: number
  readonly directParentIndex: number
  readonly containingParentIndex: number
}

export class PositioningContextResolver {
  constructor(private readonly _sceneGraph: SceneGraph) {}

  public resolveById(id: IDType): ResolvedPositioningContext | null {
    const index = this._sceneGraph.getIndex(id)
    if (index === NULL_INDEX) {
      return null
    }
    return this.resolveByIndex(index)
  }

  public resolveByIndex(index: number): ResolvedPositioningContext | null {
    if (!this._sceneGraph.isNodeIndexAlive(index)) {
      return null
    }

    const targetId = this._sceneGraph.getUUID(index)
    if (!targetId) {
      return null
    }

    const directParentIndex = this._sceneGraph.parent[index]
    const containingParentIndex =
      this._findContainingParentIndex(directParentIndex)

    return {
      targetId,
      targetIndex: index,
      directParentIndex,
      directParentId: this._idForIndex(directParentIndex),
      containingParentIndex,
      containingParentId: this._idForIndex(containingParentIndex),
    }
  }

  private _findContainingParentIndex(startIndex: number) {
    let current = startIndex
    let fallback = NULL_INDEX
    let depth = 0

    while (current !== NULL_INDEX) {
      if (depth++ > MAX_NODES) {
        throw new Error(`Tree cycle detected at node ${current}`)
      }

      const type = this._sceneGraph.type[current]
      if (type === NodeType.FRAME) {
        return current
      }
      if (type === NodeType.CANVAS) {
        fallback = current
      }
      if (type === NodeType.DOCUMENT && fallback === NULL_INDEX) {
        fallback = current
      }

      current = this._sceneGraph.parent[current]
    }

    return fallback
  }

  private _idForIndex(index: number) {
    if (index === NULL_INDEX) {
      return null
    }
    return this._sceneGraph.getUUID(index)
  }
}
