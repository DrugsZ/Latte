import type { Channels } from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'
import type { BaristaSystem } from '../systems/systems'

export interface IContext {
  readonly sceneGraph: SceneGraph
  readonly accessSystem: BaristaSystem
  getService<T>(name: Channels): T | undefined
}
