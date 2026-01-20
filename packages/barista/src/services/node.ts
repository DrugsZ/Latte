import {
  Channels,
  type INodeService,
  type NodeType,
  type IDType,
} from '@latte-js/bean'
import { ServiceBase, type IContext, service } from './serviceBase'
import type { NodeSystem } from '../systems/nodeSystem'

@service()
export class NodeService
  extends ServiceBase<NodeSystem>
  implements INodeService
{
  readonly channelName = Channels.Node

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
