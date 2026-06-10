import { Emitter } from '@latte-js/kit'

import { system, SystemBase, Systems } from './systems'

import type { IDType, NodeType } from '@latte-js/bean'
import {
  MutationPolicyKind,
  type MutationPolicyMap,
} from '../transactions/mutationPolicy'

const nodeMutationPolicies: MutationPolicyMap = {
  create: { kind: MutationPolicyKind.WriteNoHistory },
  remove: { kind: MutationPolicyKind.WriteNoHistory },
  removeChild: { kind: MutationPolicyKind.WriteNoHistory },
  insertAfter: { kind: MutationPolicyKind.WriteNoHistory },
}

@system({ mutations: nodeMutationPolicies })
export class NodeSystem extends SystemBase {
  public static readonly name = Systems.Node
  private _onCreate = new Map<string, Emitter<[id: IDType, index: number][]>>()
  private _onDelete = new Map<string, Emitter<[id: IDType, index: number][]>>()

  private get _nodeCursor() {
    return this._getCursor('node', 0)
  }

  private _getEmitter(
    emitters: Map<string, Emitter<[id: IDType, index: number][]>>
  ) {
    let emitter = emitters.get(this._currentSessionId)
    if (!emitter) {
      emitter = new Emitter()
      emitters.set(this._currentSessionId, emitter)
    }
    return emitter
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
    this._getEmitter(this._onCreate).fire([[id, index]])
    this._nodeCursor.width = 100
    this._nodeCursor.height = 100
    return id
  }

  async remove(id: IDType): Promise<void> {
    const index = this._sceneGraph.getIndex(id)
    const deleted = this._sceneGraph.deleteNode(index)
    this._getEmitter(this._onDelete).fire(deleted)
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

  onCreate(callback: (nodes: [id: IDType, index: number][]) => void) {
    return this._getEmitter(this._onCreate).event(callback)
  }

  onDelete(callback: (nodes: [id: IDType, index: number][]) => void) {
    return this._getEmitter(this._onDelete).event(callback)
  }
}
