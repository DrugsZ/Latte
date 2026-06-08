import { NodeCursor, type SceneGraph } from '@latte-js/espresso'
import { Emitter } from '@latte-js/kit'

import { system, SystemBase, Systems } from './systems'

import type { IDType, NodeType } from '@latte-js/bean'
import type { MutationPolicyMap } from '../transactions/mutationPolicy'

const nodeMutationPolicies: MutationPolicyMap = {
  create: { kind: 'writeNoHistory' },
  remove: { kind: 'writeNoHistory' },
  removeChild: { kind: 'writeNoHistory' },
  insertAfter: { kind: 'writeNoHistory' },
}

@system({ mutations: nodeMutationPolicies })
export class NodeSystem extends SystemBase {
  public static readonly name = Systems.Node
  private _nodeCursor: NodeCursor
  private _onCreate = new Emitter<[id: IDType, index: number][]>()
  public readonly onCreate = this._onCreate.event

  private _onDelete = new Emitter<[id: IDType, index: number][]>()
  public readonly onDelete = this._onDelete.event

  constructor(sceneGraph: SceneGraph) {
    super(sceneGraph)
    this._nodeCursor = new NodeCursor(this._sceneGraph, 0)
  }

  async create(
    id: IDType,
    type: NodeType,
    x: number,
    y: number
  ): Promise<IDType> {
    const index = this._sceneGraph.createNode(type, id)
    this._nodeCursor.to(index)
    this._nodeCursor.x = x
    this._nodeCursor.y = y
    this._onCreate.fire([[id, index]])
    this._nodeCursor.width = 100
    this._nodeCursor.height = 100
    return id
  }

  async remove(id: IDType): Promise<void> {
    const index = this._sceneGraph.getIndex(id)
    const deleted = this._sceneGraph.deleteNode(index)
    this._onDelete.fire(deleted)
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
