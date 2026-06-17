import type { IDType } from '@latte-js/bean'

import type { RenderRequestReason } from './renderScheduler'
import type { RenderSceneBounds, RenderSceneIndex } from './renderSceneIndex'

export interface RenderFrame {
  readonly activeRootId: IDType
  readonly viewportBounds: RenderSceneBounds
  readonly reasons: readonly RenderRequestReason[]
  readonly nodeIndices: readonly number[]
}

export interface RenderFrameBuildOptions {
  readonly activeRootId?: IDType | null
  readonly viewportBounds: RenderSceneBounds
  readonly reasons: readonly RenderRequestReason[]
}

export class RenderFrameBuilder {
  constructor(private _sceneIndex: RenderSceneIndex) {}

  public setSceneIndex(sceneIndex: RenderSceneIndex) {
    this._sceneIndex = sceneIndex
  }

  public build(options: RenderFrameBuildOptions): RenderFrame | null {
    const { activeRootId, viewportBounds, reasons } = options
    if (!activeRootId) {
      return null
    }

    return {
      activeRootId,
      viewportBounds,
      reasons: [...reasons],
      nodeIndices: this._sceneIndex.filterRenderableCandidates(
        this._sceneIndex.queryViewportCandidates(viewportBounds),
        activeRootId
      ),
    }
  }
}
