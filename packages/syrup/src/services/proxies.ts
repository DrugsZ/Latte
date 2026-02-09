import {
  Channels,
  type INodeService,
  type ITransformService,
  type ISceneService,
  type IDocumentService,
  type IQueryService,
  IRpcService,
  IContextService,
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
      return (...args: any[]) => {
        const rpc = editor.getService<IRpcService>(IRpcService)

        const contextService =
          editor.getService<IContextService>(IContextService)
        const contextId = contextService.getContextId()

        return rpc.send({
          documentId: contextId ?? undefined,
          channel: channel,
          method: String(prop),
          args: args,
        })
      }
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
