import { RENDER_AFFECTING_FLAGS } from '@latte-js/espresso'

import type {
  IDType,
  ISceneDirtyNode,
  ISceneDirtyPayload,
} from '@latte-js/bean'
import type { DirtyBatch } from './dirtyBatch'
import {
  toSceneGraphContext,
  type ISceneGraphContext,
  type SceneGraphContextSource,
} from '../context/sceneGraphContext'

export class NotificationPlanner {
  private readonly _context: ISceneGraphContext

  constructor(source: SceneGraphContextSource) {
    this._context = toSceneGraphContext(source)
  }

  private get _sceneGraph() {
    return this._context.sceneGraph
  }

  public createDirtyPayload(
    batch: DirtyBatch,
    version: number
  ): ISceneDirtyPayload | null {
    const nodes: ISceneDirtyNode[] = []
    const allIds: IDType[] = []
    const renderIds: IDType[] = []

    for (const [index, flags] of batch.entries()) {
      const id = this._sceneGraph.getUUID(index)
      if (!id) {
        continue
      }

      nodes.push({ id, flags })
      allIds.push(id)

      if ((flags & RENDER_AFFECTING_FLAGS) !== 0) {
        renderIds.push(id)
      }
    }

    if (nodes.length === 0) {
      return null
    }

    return {
      version,
      ids: renderIds,
      renderIds,
      allIds,
      nodes,
    }
  }
}
