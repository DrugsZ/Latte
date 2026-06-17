import { RenderReason } from '@latte-js/art'
import { DIRTY_TREE, type SceneGraph } from '@latte-js/espresso'
import { Disposable } from '@latte-js/kit'
import type { EditorHost } from '@latte-js/syrup'

import type { IProjectionDirtyEvent } from '../projection/projectionSyncController'

interface IRenderInvalidationProjection {
  readonly onDidMarkDirty: (
    listener: (event: IProjectionDirtyEvent) => void
  ) => { dispose(): void }
}

export class RenderInvalidationController extends Disposable {
  constructor(
    private readonly _host: EditorHost<SceneGraph>,
    projection: IRenderInvalidationProjection
  ) {
    super()

    this._register(
      projection.onDidMarkDirty(event => {
        const renderer = this._host.renderer
        if (!renderer) {
          return
        }

        if (event.renderIds.length > 0) {
          if (this._requiresSceneIndexRebuild(event)) {
            renderer.rebuildSceneIndex?.()
          } else {
            renderer.updateSceneIndexByIds?.(event.affectedIds)
          }
          renderer.requestRender(RenderReason.SceneDirty)
        }
      })
    )
  }

  private _requiresSceneIndexRebuild(event: IProjectionDirtyEvent) {
    return event.nodes.some(node => (node.flags & DIRTY_TREE) !== 0)
  }
}
