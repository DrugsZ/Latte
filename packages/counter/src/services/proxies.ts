import {
  Channels,
  type IDocumentService,
  type INodeService,
  type IQueryService,
  type ISceneService,
  type ITransformService,
} from '@latte-js/bean'
import { createDomainServiceProxy } from '@latte-js/syrup'

export const nodeService = createDomainServiceProxy<INodeService>(Channels.Node)
export const transformService = createDomainServiceProxy<ITransformService>(
  Channels.Transform
)
export const sceneService = createDomainServiceProxy<ISceneService>(
  Channels.Scene
)
export const documentService = createDomainServiceProxy<IDocumentService>(
  Channels.Document
)
export const queryService = createDomainServiceProxy<IQueryService>(
  Channels.Query
)
