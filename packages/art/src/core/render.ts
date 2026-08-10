import { toDisposable } from '@latte-js/kit'
import { type SceneGraph } from '@latte-js/espresso'

import { Camera } from './camera'
import { type RenderLayer, type RenderLayerHitTestPoint } from './renderLayer'
import { RenderReason, RenderScheduler } from './renderScheduler'
import { SceneRenderLayer } from './sceneRenderLayer'

import { type IDType } from '@latte-js/bean'

import type {
  IRenderBackendDriver,
  RenderBackendOptions,
  RenderSurface,
  RenderSurfaceSize,
} from '../contract/renderBackend'
import type { IDisposable } from '@latte-js/kit'

export type RendererFrameHandle = unknown

export interface RendererFrameScheduler {
  requestFrame(callback: () => void): RendererFrameHandle
  cancelFrame(handle: RendererFrameHandle): void
}

export interface RendererOptions {
  readonly surface: RenderSurface
  readonly size: RenderSurfaceSize
  readonly activeRootId?: IDType
  readonly backendOptions?: RenderBackendOptions
  readonly scheduler?: RendererFrameScheduler
  readonly autoStart?: boolean
}

const DEFAULT_RENDERER_FRAME_SCHEDULER: RendererFrameScheduler = {
  requestFrame(callback) {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      return globalThis.requestAnimationFrame(callback)
    }
    return globalThis.setTimeout(callback, 16)
  },
  cancelFrame(handle) {
    if (
      typeof handle === 'number' &&
      typeof globalThis.cancelAnimationFrame === 'function'
    ) {
      globalThis.cancelAnimationFrame(handle)
      return
    }
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>)
  },
}

export class Renderer {
  private _camera: Camera
  private readonly _sceneLayer: SceneRenderLayer
  private readonly _layers = new Map<string, RenderLayer>()
  private _sortedLayers: readonly RenderLayer[] | null = null
  private _renderScheduler = new RenderScheduler()
  private _frameId: RendererFrameHandle | null = null
  private _disposed = false
  private readonly _surface: RenderSurface
  private readonly _frameScheduler: RendererFrameScheduler
  private _activeRootId?: IDType
  private _pendingSceneIndexRebuild = false
  private readonly _pendingSceneIndexIds = new Set<IDType>()

  constructor(
    private _sceneGraph: SceneGraph,
    private _backend: IRenderBackendDriver,
    options: RendererOptions
  ) {
    this._surface = options.surface
    this._activeRootId = options.activeRootId
    this._frameScheduler = options.scheduler ?? DEFAULT_RENDERER_FRAME_SCHEDULER

    this._initCamera(options.size)
    this._initRenderBackend(
      options.surface,
      options.size,
      options.backendOptions
    )
    this._sceneLayer = new SceneRenderLayer(this._sceneGraph)
    this.registerLayer(this._sceneLayer)
    if (options.autoStart !== false) {
      this.start()
    }
  }

  public get sceneIndex() {
    return this._sceneLayer.sceneIndex
  }

  public get surface() {
    return this._surface
  }

  public setActiveRootId(rootId?: IDType | null) {
    this._activeRootId = rootId ?? undefined
  }

  public fitToContent(rootId: IDType = this._activeRootId!, padding = 0.1) {
    if (!rootId) return false

    const bounds = this._readConsistent(() =>
      this._sceneLayer.computeContentBounds(rootId)
    )
    if (bounds.status === 'inconsistent') {
      this.requestRender(RenderReason.SceneDirty)
      return false
    }

    if (!bounds.value) return false

    const contentBounds = bounds.value

    this._camera.fitBounds(
      contentBounds.minX,
      contentBounds.minY,
      contentBounds.maxX,
      contentBounds.maxY,
      padding
    )
    this.requestRender(RenderReason.CameraChanged)
    return true
  }

  public setGraph(graph: SceneGraph) {
    this._sceneGraph = graph
    this._sceneLayer.setGraph(graph)
    this.requestRender(RenderReason.GraphChanged)
  }

  get activeRootId() {
    return this._activeRootId
  }

  public get lastFrame() {
    return this._sceneLayer.lastFrame
  }

  public resize(size: RenderSurfaceSize) {
    this._backend.resize(size)
    this.camera.resize(size.width, size.height)
    this.requestRender(RenderReason.Resize)
  }

  private _initCamera(size: RenderSurfaceSize) {
    this._camera = new Camera(size.width, size.height)
    this._camera.fitBounds(-100, -100, size.width * 2, size.height * 2, 0)

    this._camera.onDidChange(() => {
      this.requestRender(RenderReason.CameraChanged)
    })
  }

  public get camera() {
    return this._camera
  }

  private _initRenderBackend(
    surface: RenderSurface,
    size: RenderSurfaceSize,
    options?: RenderBackendOptions
  ) {
    this._backend.init(surface, { ...options, dpr: options?.dpr ?? size.dpr })
    this._backend.resize(size)
  }

  public requestRender(reason: RenderReason | string = RenderReason.Manual) {
    this._renderScheduler.request(reason)
  }

  public registerLayer(layer: RenderLayer): IDisposable {
    if (this._layers.has(layer.id)) {
      throw new Error(`[Renderer] Render layer already registered: ${layer.id}`)
    }
    this._layers.set(layer.id, layer)
    this._invalidateLayerOrder()
    this.requestRender(RenderReason.LayerChanged)
    return toDisposable(() => {
      this.unregisterLayer(layer.id)
    })
  }

  public unregisterLayer(id: string) {
    const didDelete = this._layers.delete(id)
    if (!didDelete) {
      return
    }
    this._invalidateLayerOrder()
    this.requestRender(RenderReason.LayerChanged)
  }

  public getLayer<T extends RenderLayer = RenderLayer>(id: string) {
    return (this._layers.get(id) as T | undefined) ?? null
  }

  public hitTestLayers(point: RenderLayerHitTestPoint) {
    return this._sceneGraph.readConsistent(() => {
      const context = {
        sceneGraph: this._sceneGraph,
        camera: this._camera,
        activeRootId: this._activeRootId,
      }

      const layers = [...this._getSortedLayers()].reverse()
      for (const layer of layers) {
        if (layer.visible === false || !layer.hitTest) {
          continue
        }

        const result = layer.hitTest(point, context)
        if (result) {
          return result
        }
      }

      return null
    })
  }

  public rebuildSceneIndex() {
    const result = this._readConsistent(() => {
      this._sceneLayer.rebuildSceneIndex()
    })
    if (result.status === 'ok') {
      return
    }

    this._pendingSceneIndexRebuild = true
    this._pendingSceneIndexIds.clear()
    this.requestRender(RenderReason.SceneDirty)
  }

  public updateSceneIndexByIds(ids: Iterable<IDType>) {
    const idList = [...ids]
    const result = this._readConsistent(() => {
      this._sceneLayer.updateSceneIndexByIds(idList)
    })
    if (result.status === 'ok') {
      return
    }

    if (result.didRead) {
      this._pendingSceneIndexRebuild = true
      this._pendingSceneIndexIds.clear()
    } else if (!this._pendingSceneIndexRebuild) {
      idList.forEach(id => this._pendingSceneIndexIds.add(id))
    }
    this.requestRender(RenderReason.SceneDirty)
  }

  public queryHitTestCandidates(
    worldX: number,
    worldY: number,
    rootId: IDType = this._activeRootId!
  ) {
    if (!rootId) {
      return []
    }
    return (
      this._sceneGraph.readConsistent(() =>
        this._sceneLayer.queryHitTestCandidates(worldX, worldY, rootId)
      ) ?? []
    )
  }

  private _render() {
    if (!this._renderScheduler.hasPending) {
      return
    }

    const reasons = this._renderScheduler.consume()
    let appliedPendingSceneIndexUpdate = false
    const buffers = this._sceneGraph.readConsistent(() => {
      appliedPendingSceneIndexUpdate = this._applyPendingSceneIndexUpdates()
      const context = {
        sceneGraph: this._sceneGraph,
        camera: this._camera,
        backendSize: this._backend.getSize(),
        reasons,
        activeRootId: this._activeRootId,
      }
      const buffers: NonNullable<ReturnType<RenderLayer['encode']>>[] = []

      for (const layer of this._getSortedLayers()) {
        if (layer.visible === false) {
          continue
        }
        const commands = layer.encode(context)
        if (commands) {
          buffers.push(commands)
        }
      }
      return buffers
    })

    if (buffers === null) {
      if (appliedPendingSceneIndexUpdate) {
        this._pendingSceneIndexRebuild = true
        this._pendingSceneIndexIds.clear()
      }
      this.requestRender(RenderReason.SceneDirty)
      return
    }

    if (appliedPendingSceneIndexUpdate) {
      this._pendingSceneIndexRebuild = false
      this._pendingSceneIndexIds.clear()
    }

    for (const commands of buffers) {
      this._backend.submit(commands)
    }
  }

  private _applyPendingSceneIndexUpdates() {
    if (this._pendingSceneIndexRebuild) {
      this._sceneLayer.rebuildSceneIndex()
      return true
    }

    if (this._pendingSceneIndexIds.size === 0) {
      return false
    }

    const ids = [...this._pendingSceneIndexIds]
    this._sceneLayer.updateSceneIndexByIds(ids)
    return true
  }

  private _readConsistent<T>(
    reader: () => T
  ):
    | { readonly status: 'ok'; readonly value: T }
    | { readonly status: 'inconsistent'; readonly didRead: boolean } {
    const before = this._sceneGraph.publicationRevision
    if ((before & 1) === 1) {
      return { status: 'inconsistent', didRead: false }
    }

    const value = reader()
    const after = this._sceneGraph.publicationRevision
    if (before !== after || (after & 1) === 1) {
      return { status: 'inconsistent', didRead: true }
    }

    return { status: 'ok', value }
  }

  public renderFrame() {
    this.requestRender(RenderReason.Manual)
  }

  public start() {
    this._disposed = false
    this._scheduleRender()
  }

  public dispose() {
    this._disposed = true
    if (this._frameId !== null) {
      this._frameScheduler.cancelFrame(this._frameId)
      this._frameId = null
    }
    this._renderScheduler.clear()
    this._backend.dispose()
  }

  private _getSortedLayers() {
    if (!this._sortedLayers) {
      this._sortedLayers = [...this._layers.values()].sort((a, b) => {
        if (a.zIndex !== b.zIndex) {
          return a.zIndex - b.zIndex
        }
        return a.id.localeCompare(b.id)
      })
    }
    return this._sortedLayers
  }

  private _invalidateLayerOrder() {
    this._sortedLayers = null
  }

  private _scheduleRender() {
    if (this._disposed) {
      return
    }
    this._frameId = this._frameScheduler.requestFrame(() => {
      if (this._disposed) {
        return
      }
      this._render()
      this._scheduleRender()
    })
  }
}
