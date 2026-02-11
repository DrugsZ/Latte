import type { IDType, NodeType } from '../schema'

export interface IQueryService {
  getElementByTagName(tag: NodeType, parentID?: IDType): Promise<IDType[]>
  getElementByName(name: string, parentID?: IDType): Promise<IDType[]>
}
