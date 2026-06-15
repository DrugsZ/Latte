import {
  DIRTY_TREE,
  getNodeLifecyclePayload,
  getNodePlacement,
  PropId,
  NULL_INDEX,
} from '@latte-js/espresso'

import type { IDType, NodeType } from '@latte-js/bean'
import type { ISceneGraphContext } from '../context/sceneGraphContext'

export class SceneGraphMutationWriter {
  constructor(private readonly _context: ISceneGraphContext) {}

  private get _sceneGraph() {
    return this._context.sceneGraph
  }

  public createNode(id: IDType, type: NodeType) {
    const index = this._sceneGraph.createNode(type, id)
    this._sceneGraph.recordMutation({
      id,
      index,
      prop: PropId.CREATE_SELF,
      oldValue: null,
      newValue: getNodeLifecyclePayload(this._sceneGraph, index),
      dirtyFlag: DIRTY_TREE,
    })
    return index
  }

  public removeNode(id: IDType) {
    const index = this._getActiveIndex(id, 'removeNode')
    const oldValue = getNodeLifecyclePayload(this._sceneGraph, index)
    const deleted = this._sceneGraph.deleteNode(index)
    this._sceneGraph.recordMutation({
      id,
      index,
      prop: PropId.REMOVE_SELF,
      oldValue,
      newValue: null,
      dirtyFlag: DIRTY_TREE,
    })
    return deleted
  }

  public appendChild(parent: IDType, child: IDType) {
    const parentIndex = this._getActiveIndex(parent, 'appendChild parent')
    const childIndex = this._getActiveIndex(child, 'appendChild child')
    if (
      this._sceneGraph.parent[childIndex] === parentIndex &&
      this._sceneGraph.lastChild[parentIndex] === childIndex
    ) {
      return null
    }

    const oldValue = getNodePlacement(this._sceneGraph, childIndex)
    this._sceneGraph.appendChild(parentIndex, childIndex)
    this._recordPlacementMutation(child, childIndex, oldValue)
    return [child, childIndex] as [id: IDType, index: number]
  }

  public insertBefore(parent: IDType, child: IDType, ref: IDType | null) {
    if (ref === null) {
      return this.appendChild(parent, child)
    }

    const parentIndex = this._getActiveIndex(parent, 'insertBefore parent')
    const childIndex = this._getActiveIndex(child, 'insertBefore child')
    const refIndex = this._getActiveIndex(ref, 'insertBefore ref')
    const oldValue = getNodePlacement(this._sceneGraph, childIndex)

    if (childIndex === refIndex) {
      return null
    }
    if (this._sceneGraph.parent[refIndex] !== parentIndex) {
      throw new Error(
        '[SceneGraphMutationWriter] insertBefore ref is not child of parent'
      )
    }
    if (
      this._sceneGraph.parent[childIndex] === parentIndex &&
      this._sceneGraph.nextSibling[childIndex] === refIndex
    ) {
      return null
    }

    const previousRefSibling = this._sceneGraph.prevSibling[refIndex]
    if (previousRefSibling === NULL_INDEX) {
      this._sceneGraph.insertChildAt(parentIndex, childIndex, 1)
    } else {
      this._sceneGraph.insertAfter(parentIndex, childIndex, previousRefSibling)
    }
    this._recordPlacementMutation(child, childIndex, oldValue)
    return [child, childIndex] as [id: IDType, index: number]
  }

  public removeChild(parent: IDType, child: IDType) {
    const parentIndex = this._getActiveIndex(parent, 'removeChild parent')
    const childIndex = this._getActiveIndex(child, 'removeChild child')
    if (this._sceneGraph.parent[childIndex] !== parentIndex) {
      throw new Error(
        '[SceneGraphMutationWriter] removeChild child is not child of parent'
      )
    }
    const oldValue = getNodePlacement(this._sceneGraph, childIndex)
    this._sceneGraph.detach(childIndex)
    this._recordPlacementMutation(child, childIndex, oldValue)
    return [child, childIndex] as [id: IDType, index: number]
  }

  private _recordPlacementMutation(
    id: IDType,
    index: number,
    oldValue: ReturnType<typeof getNodePlacement>
  ) {
    this._sceneGraph.recordMutation({
      id,
      index,
      prop: PropId.PARENT,
      oldValue,
      newValue: getNodePlacement(this._sceneGraph, index),
      dirtyFlag: DIRTY_TREE,
    })
  }

  private _getActiveIndex(id: IDType, source: string) {
    const index = this._sceneGraph.getIndex(id)
    if (index === NULL_INDEX) {
      throw new Error(
        `[SceneGraphMutationWriter] Node not found: ${source} ${id}`
      )
    }
    return index
  }
}
