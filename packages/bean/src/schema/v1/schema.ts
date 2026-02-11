import type { ILatteNode, IDType } from './nodes'

export interface LatteFile {
  type: 'NODE_CHANGES'
  elements: ILatteNode[]
  sessionID: number
  guid: IDType
}
