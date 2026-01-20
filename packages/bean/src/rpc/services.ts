import type { INodeService } from './node'
import type { ISceneService } from './scene'
import type { ITransformService } from './transform'
import type { IDocumentService } from './document'
import type { IQueryService } from './query'

export enum Channels {
  Node = 'node',
  Transform = 'transform',
  Scene = 'scene',
  Document = 'document',
  Query = 'query',
}

export interface IServiceMap {
  [Channels.Node]?: INodeService
  [Channels.Transform]?: ITransformService
  [Channels.Scene]?: ISceneService
  [Channels.Document]?: IDocumentService
  [Channels.Query]?: IQueryService
}

export type ServiceMapConstructor = {
  [K in keyof IServiceMap]: new (...args: any[]) => IServiceMap[K]
}
