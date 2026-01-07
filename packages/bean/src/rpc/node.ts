import type { NodeType, IDType } from 'src/schema'

export interface INodeService {
  create(id: IDType, type: NodeType, x: number, y: number): Promise<IDType>

  remove(id: IDType): Promise<void>

  removeChild(child: IDType): Promise<void>

  insertAfter(parent: IDType, child: IDType, ref?: IDType): Promise<void>
}
