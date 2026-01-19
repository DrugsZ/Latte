import { type IDisposable } from './ipc'
import type { IDType } from '../schema'

export interface ISceneService {
  onDirty: (callback: (ids: IDType[]) => void) => IDisposable
}
