import type { IDType, ILatteFile } from '../schema/v1/nodes'
import type { IDisposable } from './ipc'

export interface IDocumentService {
  load(data: ILatteFile): Promise<Map<IDType, number>>
  save(): Promise<ILatteFile>

  onLoad(cb: (map: Map<IDType, number>) => void): IDisposable
  onSave(cb: () => void): IDisposable
}
