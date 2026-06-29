import { type IDType, type NodeType } from '../schema'

import { type IDisposable } from './ipc'

export interface ICreateNodeOptions {
  readonly id: IDType
  readonly type: NodeType
  readonly x?: number
  readonly y?: number
  readonly width?: number
  readonly height?: number
}

export interface ICreateRectangleOptions {
  readonly id?: IDType
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
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
  createRectangle(
    parent: IDType,
    options: ICreateRectangleOptions
  ): Promise<IDType>
  setName(id: IDType, name: string): Promise<void>
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
