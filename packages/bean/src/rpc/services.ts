import type { INodeService } from './node'
import type { ITransformService } from './transform'

export const Channels = {
  Node: 'node',
  Transform: 'transform',
} as const

export type ChannelID = (typeof Channels)[keyof typeof Channels]

export interface IServiceMap {
  [Channels.Node]?: INodeService
  [Channels.Transform]?: ITransformService
}

export type ServiceMapConstructor = {
  [K in keyof IServiceMap]: new (...args: any[]) => IServiceMap[K]
}
