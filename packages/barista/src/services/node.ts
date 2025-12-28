import type { INodeService, NodeType, IDType } from '@latte-js/bean'
import { NodeCursor, type SceneGraph } from '@latte-js/espresso'

export class NodeService implements INodeService {
  private _nodeCursor: NodeCursor

  constructor(private _sceneGraph: SceneGraph) {
    this._nodeCursor = new NodeCursor(this._sceneGraph, -1)
  }

  async create(
    id: IDType,
    type: NodeType,
    x: number,
    y: number
  ): Promise<string> {
    const index = this._sceneGraph.createNode(type, id)
    this._nodeCursor.to(index)
    this._nodeCursor.x = x
    this._nodeCursor.y = y
    return index.toString()
  }

  async remove(id: IDType): Promise<void> {
    const index = this._sceneGraph.getIndex(id)
    this._sceneGraph.deleteNode(index)
  }

  async removeChild(child: IDType): Promise<void> {
    const childIndex = this._sceneGraph.getIndex(child)
    this._sceneGraph.detach(childIndex)
  }

  async insertAfter(
    parent: IDType,
    child: IDType,
    ref?: IDType
  ): Promise<void> {
    const parentIndex = this._sceneGraph.getIndex(parent)
    const childIndex = this._sceneGraph.getIndex(child)
    const refIndex = ref ? this._sceneGraph.getIndex(ref) : -1
    this._sceneGraph.insertAfter(parentIndex, childIndex, refIndex)
  }
}
