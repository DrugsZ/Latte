import {
  Channels,
  type ICreateNodeOptions,
  type ICreateRectangleOptions,
  type INodeLifecycleEvent,
  type INodeMoveEvent,
  type IDType,
  type INodeService,
} from '@latte-js/bean'

import { Service, SystemBackedServiceBase, type IContext } from './serviceBase'

import type { NodeSystem } from '../systems/node'
import { Systems } from '../systems'

@Service({ system: Systems.Node })
export class NodeService
  extends SystemBackedServiceBase<NodeSystem>
  implements INodeService
{
  public static readonly name = Channels.Node

  constructor(ctx: IContext) {
    super(ctx)
  }

  async createNode(options: ICreateNodeOptions): Promise<IDType> {
    return this.system.createNode(options)
  }

  async createRectangle(
    parent: IDType,
    options: ICreateRectangleOptions
  ): Promise<IDType> {
    return this.system.createRectangle(parent, options)
  }

  async setName(id: IDType, name: string): Promise<void> {
    return this.system.setName(id, name)
  }

  async appendChild(parent: IDType, child: IDType): Promise<IDType> {
    return this.system.appendChild(parent, child)
  }

  async insertBefore(
    parent: IDType,
    child: IDType,
    ref: IDType | null
  ): Promise<IDType> {
    return this.system.insertBefore(parent, child, ref)
  }

  async removeChild(parent: IDType, child: IDType): Promise<IDType> {
    return this.system.removeChild(parent, child)
  }

  async deleteNode(id: IDType): Promise<void> {
    return this.system.deleteNode(id)
  }

  onDidCreateNode(callback: (event: INodeLifecycleEvent) => void) {
    const sessionId = this.currentSessionId
    return this.system.onDidCreateNode(event => {
      if (event.sessionId === sessionId) {
        callback({ nodes: event.nodes })
      }
    })
  }

  onDidDeleteNode(callback: (event: INodeLifecycleEvent) => void) {
    const sessionId = this.currentSessionId
    return this.system.onDidDeleteNode(event => {
      if (event.sessionId === sessionId) {
        callback({ nodes: event.nodes })
      }
    })
  }

  onDidMoveNode(callback: (event: INodeMoveEvent) => void) {
    const sessionId = this.currentSessionId
    return this.system.onDidMoveNode(event => {
      if (event.sessionId === sessionId) {
        callback({ nodes: event.nodes })
      }
    })
  }
}
