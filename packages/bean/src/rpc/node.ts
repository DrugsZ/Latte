import { type IDType, type NodeType } from '../schema'
import { type IDisposable } from './ipc'

export interface INodeService {
  create(id: IDType, type: NodeType, x: number, y: number): Promise<IDType>
  remove(id: IDType): Promise<void>
  removeChild(child: IDType): Promise<void>
  insertAfter(parent: IDType, child: IDType, ref?: IDType): Promise<void>
  onCreate(
    callback: (nodes: [id: IDType, index: number][]) => void
  ): IDisposable
  onDelete(
    callback: (nodes: [id: IDType, index: number][]) => void
  ): IDisposable
}
