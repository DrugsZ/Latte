import { Emitter, type Event } from '@latte-js/kit'
import { System, SystemBase, Systems } from './systems'

import { NodeType } from '@latte-js/bean'
import type {
  ICreateNodeOptions,
  ICreateRectangleOptions,
  IDType,
} from '@latte-js/bean'
import {
  MutationPolicyKind,
  type MutationPolicyMap,
} from '../transactions/mutationPolicy'
import { TransactionLabel } from '../transactions/transactionLabels'

export type NodeChange = [id: IDType, index: number]

export interface INodeSystemChangeEvent {
  readonly sessionId: string
  readonly nodes: NodeChange[]
}

const nodeMutationPolicies: MutationPolicyMap = {
  createNode: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.CreateLayer,
    ids: args => [(args[0] as ICreateNodeOptions).id],
  },
  createRectangle: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.CreateLayer,
    ids: args => {
      const options = args[1] as ICreateRectangleOptions
      return options.id ? [options.id] : []
    },
  },
  setName: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.RenameLayer,
    ids: args => [args[0] as IDType],
  },
  deleteNode: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.DeleteLayer,
    ids: args => [args[0] as IDType],
  },
  appendChild: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.ReorderLayer,
    ids: args => [args[1] as IDType],
  },
  insertBefore: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.ReorderLayer,
    ids: args => [args[1] as IDType],
  },
  removeChild: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.DetachLayer,
    ids: args => [args[1] as IDType],
  },
}

@System({ mutations: nodeMutationPolicies })
export class NodeSystem extends SystemBase {
  public static readonly name = Systems.Node
  private readonly _onDidCreateNode = new Emitter<INodeSystemChangeEvent>()
  public readonly onDidCreateNode: Event<INodeSystemChangeEvent> =
    this._onDidCreateNode.event

  private readonly _onDidDeleteNode = new Emitter<INodeSystemChangeEvent>()
  public readonly onDidDeleteNode: Event<INodeSystemChangeEvent> =
    this._onDidDeleteNode.event

  private readonly _onDidMoveNode = new Emitter<INodeSystemChangeEvent>()
  public readonly onDidMoveNode: Event<INodeSystemChangeEvent> =
    this._onDidMoveNode.event

  private get _nodeCursor() {
    return this._getCursor('node', 0)
  }

  async createNode(options: ICreateNodeOptions): Promise<IDType> {
    const index = this._mutationWriter.createNode(options.id, options.type)
    this._nodeCursor.to(index)
    this._nodeCursor.x = options.x ?? 0
    this._nodeCursor.y = options.y ?? 0
    this._nodeCursor.width = options.width ?? 100
    this._nodeCursor.height = options.height ?? 100
    this._onDidCreateNode.fire({
      sessionId: this._currentSessionId,
      nodes: [[options.id, index]],
    })
    return options.id
  }

  async createRectangle(
    parent: IDType,
    options: ICreateRectangleOptions
  ): Promise<IDType> {
    const id = options.id ?? this._createNodeId('rectangle')
    const index = this._mutationWriter.createNode(id, NodeType.RECTANGLE)
    this._nodeCursor.to(index)
    this._nodeCursor.x = options.x
    this._nodeCursor.y = options.y
    this._nodeCursor.width = options.width
    this._nodeCursor.height = options.height

    const moved = this._mutationWriter.appendChild(parent, id)
    this._onDidCreateNode.fire({
      sessionId: this._currentSessionId,
      nodes: [[id, index]],
    })
    this._fireDidMoveNode(moved)
    return id
  }

  async setName(id: IDType, name: string): Promise<void> {
    this._nodeCursor.toID(id)
    this._nodeCursor.name = name
  }

  async deleteNode(id: IDType): Promise<void> {
    const deleted = this._mutationWriter.removeNode(id)
    this._onDidDeleteNode.fire({
      sessionId: this._currentSessionId,
      nodes: deleted,
    })
  }

  async appendChild(parent: IDType, child: IDType): Promise<IDType> {
    const moved = this._mutationWriter.appendChild(parent, child)
    this._fireDidMoveNode(moved)
    return child
  }

  async insertBefore(
    parent: IDType,
    child: IDType,
    ref: IDType | null
  ): Promise<IDType> {
    const moved = this._mutationWriter.insertBefore(parent, child, ref)
    this._fireDidMoveNode(moved)
    return child
  }

  async removeChild(parent: IDType, child: IDType): Promise<IDType> {
    const moved = this._mutationWriter.removeChild(parent, child)
    this._fireDidMoveNode(moved)
    return child
  }

  private _fireDidMoveNode(node: NodeChange | null) {
    if (!node) {
      return
    }
    this._onDidMoveNode.fire({
      sessionId: this._currentSessionId,
      nodes: [node],
    })
  }

  private _createNodeId(prefix: string): IDType {
    const random =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    return `${prefix}:${random}`
  }
}
