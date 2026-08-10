import type { IDocumentService } from './document'
import type { INodeService } from './node'
import type { IPropertyService } from './property'
import type { IQueryService } from './query'
import type { ISceneService } from './scene'
import type { IStyleService } from './style'
import type { ITransformService } from './transform'
import type { IUndoRedoService } from './undoRedo'

export enum Channels {
  Node = 'node',
  Transform = 'transform',
  Scene = 'scene',
  Document = 'document',
  Query = 'query',
  UndoRedo = 'undoRedo',
  Style = 'style',
  Property = 'property',
}

export type ChannelID = `${Channels}`

export interface IServiceMap {
  [Channels.Node]: INodeService
  [Channels.Transform]: ITransformService
  [Channels.Scene]: ISceneService
  [Channels.Document]: IDocumentService
  [Channels.Query]: IQueryService
  [Channels.UndoRedo]: IUndoRedoService
  [Channels.Style]: IStyleService
  [Channels.Property]: IPropertyService
}

export type ServiceMapConstructor = {
  [K in keyof IServiceMap]: new (...args: any[]) => IServiceMap[K]
}
