import type { IDType, NodeType } from '../schema'

export interface IQueryService {
  getElementByTagName(
    tag: keyof typeof NodeType,
    parentID?: IDType
  ): Promise<number[]>
  getElementByName(name: string, parentID?: IDType): Promise<number[]>
}
