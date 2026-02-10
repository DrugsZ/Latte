import {
  Channels,
  type IDType,
  type INodeService,
  type NodeType,
} from '@latte-js/bean'

import { service, ServiceBase, type IContext } from './serviceBase'

import type { NodeSystem } from '../systems/node'

@service
export class NodeService
  extends ServiceBase<NodeSystem>
  implements INodeService
{
  public static readonly name = Channels.Node

  constructor(ctx: IContext) {
    super(ctx)
  }

  async create(
    id: IDType,
    type: NodeType,
    x: number,
    y: number
  ): Promise<IDType> {
    return this.system.create(id, type, x, y)
  }
  async remove(id: IDType): Promise<void> {
    return this.system.remove(id)
  }

  async removeChild(child: IDType): Promise<void> {
    return this.system.removeChild(child)
  }

  async insertAfter(
    parent: IDType,
    child: IDType,
    ref?: IDType
  ): Promise<void> {
    return this.system.insertAfter(parent, child, ref)
  }

  onCreate(callback: (nodes: [id: IDType, index: number][]) => void) {
    return this.system.onCreate(callback)
  }

  onDelete(callback: (nodes: [id: IDType, index: number][]) => void) {
    return this.system.onDelete(callback)
  }
}
