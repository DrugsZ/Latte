import type { SceneGraph } from '@latte-js/espresso'
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
        if (event.renderIds.length > 0) {
          this._host.renderer?.requestRender()
        }
      })
    )
  }
}
