import {
  Channels,
  type IDocumentService,
  type INodeService,
  type IQueryService,
  type ISceneService,
  type ITransformService,
  type IUndoRedoService,
} from '@latte-js/bean'

import { editor } from '../../core/editor'

const resolveService = (channel: string) => {
  try {
    return editor.getService(channel)
  } catch {
    return editor.baristaClient?.getService(channel as Channels)
  }
}

/**
 * Create a VSCode-style domain service facade.
 * The caller does not need to know whether the service is local or RPC-backed.
 */
export function createDomainServiceProxy<T extends object>(channel: string): T {
  return new Proxy({} as T, {
    get: (_target, prop) => {
      if (typeof prop !== 'string') {
        return undefined
      }

      return (...args: unknown[]) => {
        const service = resolveService(channel) as Record<string, unknown>
        const value = service?.[prop]

        if (typeof value === 'function') {
          return value.apply(service, args)
        }

        return value
      }
    },
  })
}

export const createServiceProxy = createDomainServiceProxy

export const nodeService = createServiceProxy<INodeService>(Channels.Node)
export const transformService = createServiceProxy<ITransformService>(
  Channels.Transform
)
export const sceneService = createServiceProxy<ISceneService>(Channels.Scene)
export const documentService = createServiceProxy<IDocumentService>(
  Channels.Document
)
export const queryService = createServiceProxy<IQueryService>(Channels.Query)
export const undoRedoService = createServiceProxy<IUndoRedoService>(
  Channels.UndoRedo
)
