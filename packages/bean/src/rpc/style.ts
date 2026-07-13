import type { IDType, IPaint } from '../schema'

export interface IStyleService {
  setFill(id: IDType, paint: IPaint): Promise<void>
  clearFill(id: IDType): Promise<void>
}
