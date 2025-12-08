import type { ILatteNode, IDType, IParentIndex } from '../schema'

export enum OpType {
  PROP_UPDATE = 1,
  NODE_CREATE = 2,
  NODE_DELETE = 3,
  NODE_MOVE = 4,
}

export type Operation =
  | {
      type: OpType.PROP_UPDATE
      id: string
      key: string
      value: keyof ILatteNode | null | number | boolean | object
      timestamp: number
    }
  | { type: OpType.NODE_CREATE; node: ILatteNode }
  | { type: OpType.NODE_DELETE; id: string }
  | {
      type: OpType.NODE_MOVE
      guid: IDType
      parentIndex: IParentIndex
    }
