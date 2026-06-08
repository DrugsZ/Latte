import { RENDER_AFFECTING_FLAGS, type SceneGraph } from '@latte-js/espresso'

import type {
  IDType,
  ISceneDirtyNode,
  ISceneDirtyPayload,
} from '@latte-js/bean'
import type { DirtyBatch } from './dirtyBatch'

export class NotificationPlanner {
  constructor(private readonly _sceneGraph: SceneGraph) {}

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
