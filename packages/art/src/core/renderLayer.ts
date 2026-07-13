import type { IDType } from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'

import type { Camera } from './camera'
import type { RenderRequestReason } from './renderScheduler'
import type {
  RenderCommandBuffer,
  RenderSurfaceSize,
} from '../contract/renderBackend'

export interface RenderLayerPoint {
  readonly x: number
  readonly y: number
}

export interface RenderLayerHitTestPoint {
  readonly viewport: RenderLayerPoint
  readonly world: RenderLayerPoint
}

export interface RenderLayerHitResult {
  readonly layerId: string
  readonly targetId?: string
  readonly data?: unknown
}

export interface RenderLayerEncodeContext {
  readonly sceneGraph: SceneGraph
  readonly camera: Camera
  readonly backendSize: RenderSurfaceSize
  readonly reasons: readonly RenderRequestReason[]
  readonly activeRootId?: IDType | null
}

export interface RenderLayerHitTestContext {
  readonly sceneGraph: SceneGraph
  readonly camera: Camera
  readonly activeRootId?: IDType | null
}

export interface RenderLayer {
  readonly id: string
  readonly zIndex: number
  readonly visible?: boolean
  encode(context: RenderLayerEncodeContext): RenderCommandBuffer | null
  hitTest?(
    point: RenderLayerHitTestPoint,
    context: RenderLayerHitTestContext
  ): RenderLayerHitResult | null
}
