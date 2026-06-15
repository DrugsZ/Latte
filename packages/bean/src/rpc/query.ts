import type { IDType, NodeType } from '../schema'

export interface IQueryOptions {
  readonly rootId?: IDType
  readonly includeRoot?: boolean
}

export interface IQueryService {
  getElementsByType(type: NodeType, options?: IQueryOptions): Promise<IDType[]>
  getElementsByName(name: string, options?: IQueryOptions): Promise<IDType[]>
}
