import { type IDType, type IPaint, type NodeType } from '../schema'

import { type IDisposable } from './ipc'

export interface ICreateNodeOptions {
  readonly id: IDType
  readonly type: NodeType
  /** Attaches the new node in the same undoable creation operation. */
  readonly parentId?: IDType
  readonly name?: string
  readonly fills?: IPaint[]
  readonly x?: number
  readonly y?: number
  readonly width?: number
  readonly height?: number
}

export type NodeChange = [id: IDType, index: number]

export interface INodeLifecycleEvent {
  readonly nodes: NodeChange[]
}

export interface INodeMoveEvent {
  readonly nodes: NodeChange[]
}

export interface INodeService {
  createNode(options: ICreateNodeOptions): Promise<IDType>
  appendChild(parent: IDType, child: IDType): Promise<IDType>
  insertBefore(
    parent: IDType,
    child: IDType,
    ref: IDType | null
  ): Promise<IDType>
  removeChild(parent: IDType, child: IDType): Promise<IDType>
  deleteNode(id: IDType): Promise<void>
  onDidCreateNode(callback: (event: INodeLifecycleEvent) => void): IDisposable
  onDidDeleteNode(callback: (event: INodeLifecycleEvent) => void): IDisposable
  onDidMoveNode(callback: (event: INodeMoveEvent) => void): IDisposable
}
