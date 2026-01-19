import type { INodeService } from './node'
import type { ISceneService } from './scene'
import type { ITransformService } from './transform'

export const Channels = {
  Node: 'node',
  Transform: 'transform',
  Scene: 'scene',
} as const

export type ChannelID = (typeof Channels)[keyof typeof Channels]

export interface IServiceMap {
  [Channels.Node]?: INodeService
  [Channels.Transform]?: ITransformService
  [Channels.Scene]?: ISceneService
}

export type ServiceMapConstructor = {
  [K in keyof IServiceMap]: new (...args: any[]) => IServiceMap[K]
}
