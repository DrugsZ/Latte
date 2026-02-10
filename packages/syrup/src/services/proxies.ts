import {
  Channels,
  type IDocumentService,
  type INodeService,
  type IQueryService,
  type ISceneService,
  type ITransformService,
} from '@latte-js/bean'

import { editor } from '../core/editor'

/**
 *
 * @param channel server channel name
 * @returns
 */
export function createServiceProxy<T extends object>(channel: string): T {
  return new Proxy({} as T, {
    get: (_target, prop) => {
      return editor.getService(channel)
    },
  })
}

export const nodeService = createServiceProxy<INodeService>(Channels.Node)
export const transformService = createServiceProxy<ITransformService>(
  Channels.Transform
)
export const sceneService = createServiceProxy<ISceneService>(Channels.Scene)
export const documentService = createServiceProxy<IDocumentService>(
  Channels.Document
)
export const queryService = createServiceProxy<IQueryService>(Channels.Query)
