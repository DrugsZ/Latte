import { Channels, type ServiceMapConstructor } from '@latte-js/bean'
import { NodeService } from './node'
import type { SceneGraph } from '@latte-js/espresso'

export const createServices = (
  sceneGraph: SceneGraph
): ServiceMapConstructor => ({
  [Channels.Node]: NodeService,
})
