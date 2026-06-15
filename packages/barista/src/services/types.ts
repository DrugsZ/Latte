import type { Channels, IServiceMap } from '@latte-js/bean'
import type {
  ISceneGraphMutationAuthority,
  SceneGraph,
} from '@latte-js/espresso'
import type { BaristaSystem } from '../systems/systems'

export interface IContext {
  readonly sceneGraph: SceneGraph
  readonly mutationAuthority: ISceneGraphMutationAuthority
  readonly accessSystem: BaristaSystem
  readonly currentSessionId: string
  getService<T extends Channels>(name: T): IServiceMap[T]
}
