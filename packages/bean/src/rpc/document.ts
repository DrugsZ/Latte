import type { IDType, ILatteFile } from '../schema/v1/nodes'

export interface IDocumentService {
  load(data: ILatteFile): Promise<void>
  save(): Promise<ILatteFile>

  onLoad(cb: (map: Map<IDType, number>) => void): void
  onSave(cb: () => void): void
}
