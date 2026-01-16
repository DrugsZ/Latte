import type { INodeService, NodeType, IDType } from '@latte-js/bean'
import { type SceneGraph } from '@latte-js/espresso'
import type { AccessSystem } from '../systems/systems'
import type { NodeSystem } from '../systems/nodeSystem'

export class NodeService implements INodeService {
  private _system: NodeSystem

  constructor(
    private _sceneGraph: SceneGraph,
    accessSystem: AccessSystem
  ) {
    this._system = accessSystem('node')!
  }

  async create(
    id: IDType,
    type: NodeType,
    x: number,
    y: number
  ): Promise<string> {
    return this._system.create(id, type, x, y)
  }
  async remove(id: IDType): Promise<void> {
    return this._system.remove(id)
  }

  async removeChild(child: IDType): Promise<void> {
    return this._system.removeChild(child)
  }

  async insertAfter(
    parent: IDType,
    child: IDType,
    ref?: IDType
  ): Promise<void> {
    return this._system.insertAfter(parent, child, ref)
  }

  onCreate(callback: (nodes: [id: IDType, index: number][]) => void) {
    return this._system.onCreate(callback)
  }

  onDelete(callback: (nodes: [id: IDType, index: number][]) => void) {
    return this._system.onDelete(callback)
  }
}
