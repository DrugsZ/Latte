import {
  type SceneGraph,
  MAT_SIZE,
  MAX_NODES,
  NodeLifecycle,
  NULL_INDEX,
} from '@latte-js/espresso'
import { mat2d } from 'gl-matrix'

import { Camera } from './camera'
import { RenderCommandEncoder } from './renderCommandEncoder'
import { RenderFrameBuilder, type RenderFrame } from './renderFrameBuilder'
import { RenderReason, RenderScheduler } from './renderScheduler'
import { RenderSceneIndex } from './renderSceneIndex'

import { NodeType, type IDType } from '@latte-js/bean'
import { RenderCommandBuffer } from '../contract/renderBackend'

import type {
  IRenderBackendDriver,
  RenderBackendOptions,
  RenderSurface,
  RenderSurfaceSize,
} from '../contract/renderBackend'

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
  private _sceneIndex: RenderSceneIndex
  private _frameBuilder: RenderFrameBuilder
  private _commandEncoder = new RenderCommandEncoder()
  private _renderScheduler = new RenderScheduler()
  private _lastFrame: RenderFrame | null = null
  private _frameId: RendererFrameHandle | null = null
  private _disposed = false
  private readonly _surface: RenderSurface
  private readonly _frameScheduler: RendererFrameScheduler
  private _size: RenderSurfaceSize
  private _activeRootId?: IDType

  constructor(
    private _sceneGraph: SceneGraph,
    private _backend: IRenderBackendDriver,
    options: RendererOptions
  ) {
    this._surface = options.surface
    this._size = options.size
    this._activeRootId = options.activeRootId
    this._frameScheduler = options.scheduler ?? DEFAULT_RENDERER_FRAME_SCHEDULER

    this._initCamera(options.size)
    this._initRenderBackend(
      options.surface,
      options.size,
      options.backendOptions
    )
    this._sceneIndex = new RenderSceneIndex(this._sceneGraph)
    this._frameBuilder = new RenderFrameBuilder(this._sceneIndex)
    if (options.autoStart !== false) {
      this.start()
    }
  }

  public get sceneIndex() {
    return this._sceneIndex
  }

  public get surface() {
    return this._surface
  }

  public setActiveRootId(rootId?: IDType | null) {
    this._activeRootId = rootId ?? undefined
  }

  public fitToContent(rootId: IDType = this._activeRootId!, padding = 0.1) {
    if (!rootId) return false

    const rootIndex = this._sceneGraph.getIndex(rootId)
    if (rootIndex === NULL_INDEX) return false

    const bounds = this._computeContentBounds(rootIndex)
    if (!bounds) return false

    this._camera.fitBounds(
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
      padding
    )
    this.requestRender(RenderReason.CameraChanged)
    return true
  }

  public setGraph(graph: SceneGraph) {
    this._sceneGraph = graph
    this._sceneIndex.setGraph(graph)
    this.requestRender(RenderReason.GraphChanged)
  }

  get activeRootId() {
    return this._activeRootId
  }

  public get lastFrame() {
    return this._lastFrame
  }

  public resize(size: RenderSurfaceSize) {
    this._size = size
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

  public rebuildSceneIndex() {
    this._sceneIndex.rebuild()
  }

  public updateSceneIndexByIds(ids: Iterable<IDType>) {
    this._sceneIndex.updateByIds(ids)
  }

  public queryHitTestCandidates(
    worldX: number,
    worldY: number,
    rootId: IDType = this._activeRootId!
  ) {
    if (!rootId) {
      return []
    }
    return this._sceneIndex.filterRenderableCandidates(
      this._sceneIndex.queryPointCandidates(worldX, worldY),
      rootId
    )
  }

  private _computeContentBounds(rootIndex: number) {
    const identity = mat2d.create()
    const stack: { index: number; parentMatrix: mat2d }[] = [
      { index: rootIndex, parentMatrix: identity },
    ]
    const visited = new Set<number>()
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    while (stack.length) {
      const { index, parentMatrix } = stack.pop()!
      if (visited.has(index)) {
        throw new Error(`Tree cycle detected at node ${index}`)
      }
      if (visited.size > MAX_NODES) {
        throw new Error('Tree cycle detected')
      }

      visited.add(index)
      if (!this._isRenderableNode(index)) {
        continue
      }

      const local = this._sceneGraph.matrix.subarray(
        index * MAT_SIZE,
        index * MAT_SIZE + MAT_SIZE
      ) as mat2d
      const world = mat2d.create()
      mat2d.multiply(world, parentMatrix, local)

      const type = this._sceneGraph.type[index]
      const width = this._sceneGraph.size[index * 2]
      const height = this._sceneGraph.size[index * 2 + 1]
      if (
        type !== NodeType.DOCUMENT &&
        type !== NodeType.CANVAS &&
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width > 0 &&
        height > 0
      ) {
        const corners = [
          [0, 0],
          [width, 0],
          [width, height],
          [0, height],
        ]
        for (const [x, y] of corners) {
          const tx = world[0] * x + world[2] * y + world[4]
          const ty = world[1] * x + world[3] * y + world[5]
          minX = Math.min(minX, tx)
          minY = Math.min(minY, ty)
          maxX = Math.max(maxX, tx)
          maxY = Math.max(maxY, ty)
        }
      }

      const children: number[] = []
      let childIdx = this._sceneGraph.firstChild[index]
      const visitedChildren = new Set<number>()
      while (childIdx !== NULL_INDEX) {
        if (visitedChildren.has(childIdx)) {
          throw new Error(`Tree cycle detected at node ${childIdx}`)
        }
        visitedChildren.add(childIdx)
        children.push(childIdx)
        childIdx = this._sceneGraph.nextSibling[childIdx]
      }
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({ index: children[i], parentMatrix: world })
      }
    }

    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY)
    ) {
      return null
    }

    return { minX, minY, maxX, maxY }
  }

  private _render() {
    if (!this._renderScheduler.hasPending) {
      return
    }

    const reasons = this._renderScheduler.consume()
    if (!this._activeRootId) {
      this._clearFrame()
      this._lastFrame = null
      return
    }

    const frame = this._frameBuilder.build({
      activeRootId: this._activeRootId,
      viewportBounds: this._camera.getViewportBounds(),
      reasons,
    })
    if (!frame) {
      this._clearFrame()
      this._lastFrame = null
      return
    }

    this._actualRender(frame)
  }

  private _actualRender(frame: RenderFrame) {
    const matrix = this._camera.getMatrix()
    const commands = this._commandEncoder.encode({
      frame,
      sceneGraph: this._sceneGraph,
      cameraMatrix: matrix,
      clearBounds: {
        x: 0,
        y: 0,
        width: this._backend.getSize().width,
        height: this._backend.getSize().height,
      },
    })
    this._backend.submit(commands)
    this._lastFrame = frame
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
    this._lastFrame = null
    this._backend.dispose()
  }

  private _clearFrame() {
    const commands = new RenderCommandBuffer()
    const size = this._backend.getSize()
    commands.setClear({ x: 0, y: 0, width: size.width, height: size.height })
    this._backend.submit(commands)
  }

  private _isRenderableNode(index: number) {
    return (
      (this._sceneGraph.lifecycle[index] & NodeLifecycle.Active) !== 0 &&
      this._sceneGraph.visible[index] === 1
    )
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
