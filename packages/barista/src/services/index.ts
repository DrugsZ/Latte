import { Channels, type ServiceMapConstructor } from '@latte-js/bean'
import { NodeService } from './node'
import { TransformService } from './transform'
import type { SceneGraph } from '@latte-js/espresso'
import type { AccessSystem } from '../systems/systems'

export const createServices = (
  sceneGraph: SceneGraph,
  accessSystem?: AccessSystem
): ServiceMapConstructor => ({
  [Channels.Node]: NodeService,
  [Channels.Transform]: TransformService,
})
