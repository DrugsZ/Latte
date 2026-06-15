import { type IDisposable } from './ipc'

import type { IDType } from '../schema'

export interface ISceneDirtyNode {
  id: IDType
  flags: number
}

export interface ISceneDirtyPayload {
  version: number
  ids: IDType[]
  renderIds: IDType[]
  allIds: IDType[]
  nodes: ISceneDirtyNode[]
}

export interface ISceneService {
  onDirty: (callback: (payload: ISceneDirtyPayload) => void) => IDisposable
}
