import {
  type SceneGraph,
  MAT_SIZE,
  MAX_NODES,
  NodeCursor,
  NodeLifecycle,
  NULL_INDEX,
} from '@latte-js/espresso'
import { mat2d } from 'gl-matrix'

import { Camera } from './camera'
import { RenderFrameBuilder, type RenderFrame } from './renderFrameBuilder'
import { RenderReason, RenderScheduler } from './renderScheduler'
import { RenderSceneIndex } from './renderSceneIndex'
import { getRenderer } from './rendererRegistry'

import { NodeType, type IDType } from '@latte-js/bean'
import type { IRenderBackend } from '../contract/renderBackend'

export class Renderer {
  private _camera: Camera
  private _tempMatrix: mat2d = mat2d.create()
  private _sceneIndex: RenderSceneIndex
  private _frameBuilder: RenderFrameBuilder
  private _renderScheduler = new RenderScheduler()
  private _lastFrame: RenderFrame | null = null
  private _canvas: HTMLCanvasElement
  private _frameId: number | null = null
  private _resizeObserver: ResizeObserver | null = null
  private _disposed = false

  constructor(
    private _sceneGraph: SceneGraph,
    private _backend: IRenderBackend,
    private _container: HTMLDivElement,
    private _activeRootId?: IDType
  ) {
    const canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    this._container.appendChild(canvas)
    this._canvas = canvas

    this._initCamera()
    this._initRenderBackend()
    this._initObserver(canvas)
    this._sceneIndex = new RenderSceneIndex(this._sceneGraph)
    this._frameBuilder = new RenderFrameBuilder(this._sceneIndex)
    this.start()
  }

  public get sceneIndex() {
    return this._sceneIndex
  }

  public get canvas() {
    return this._canvas
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

  public resize(width: number, height: number) {
    this._backend.resize(width, height, window.devicePixelRatio)

    this.camera.resize(width, height)
    this.requestRender(RenderReason.Resize)
  }

  private _initObserver(container: HTMLCanvasElement) {
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      this.resize(width, height)
    })
    observer.observe(container)
    this._resizeObserver = observer
  }

  private _initCamera() {
    const rect = this._container.getBoundingClientRect()
    this._camera = new Camera(rect.width, rect.height)
    this._camera.fitBounds(-100, -100, rect.right * 2, rect.bottom * 2, 0)

    this._camera.onDidChange(() => {
      this.requestRender(RenderReason.CameraChanged)
    })
  }

  public get camera() {
    return this._camera
  }

  private _initRenderBackend() {
    const rect = this._container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this._backend.init(this._canvas, dpr)
    this._backend.resize(rect.width, rect.height, dpr)
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
    this._backend.setTransform(new Float32Array([1, 0, 0, 1, 0, 0]))
    this._clearRect()

    this._backend.beginFrame()

    const node = new NodeCursor(this._sceneGraph, -1)
    for (const id of frame.nodeIndices) {
      node.to(id)
      const { worldTransform: wt } = node
      const type = node.type
      const a = wt[0]
      const b = wt[1]
      const c = wt[2]
      const d = wt[3]
      const tx = wt[4]
      const ty = wt[5]

      mat2d.set(this._tempMatrix, a, b, c, d, tx, ty)

      // Combine with camera matrix for rendering
      mat2d.multiply(this._tempMatrix, matrix, this._tempMatrix)

      this._backend.setTransform(new Float32Array(this._tempMatrix))

      const renderer = getRenderer(type)
      if (renderer) {
        renderer.render(this._backend, node)
      }
    }

    // this._backend.drawRect(
    //   this._nodeCursor.x,
    //   this._nodeCursor.y,
    //   this._nodeCursor.width,
    //   this._nodeCursor.height,
    //   0,
    //   0xffffffff,
    //   255,
    //   1
    // )
    // this._backend.drawText(
    //   `testtest${this._testNumber++}`,
    //   this._nodeCursor.x,
    //   this._nodeCursor.y,
    //   'serif',
    //   14,
    //   0x000000ff
    // )

    // this._backend.drawRect(-10, -1, 20, 2, 0, 0xff0000ff)
    // this._backend.drawRect(-1, -10, 2, 20, 0, 0xff0000ff)
    this._backend.setTransform(new Float32Array(matrix))
    this._backend.endFrame()
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
      cancelAnimationFrame(this._frameId)
      this._frameId = null
    }
    this._resizeObserver?.disconnect()
    this._resizeObserver = null
    this._renderScheduler.clear()
    this._lastFrame = null
    this._backend.dispose()
    this._canvas.remove()
  }

  private _clearRect() {
    this._backend.clearRect(
      0,
      0,
      this._backend.getWidth(),
      this._backend.getHeight()
    )
  }

  private _clearFrame() {
    this._backend.setTransform(new Float32Array([1, 0, 0, 1, 0, 0]))
    this._clearRect()
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
    this._frameId = requestAnimationFrame(() => {
      if (this._disposed) {
        return
      }
      this._render()
      this._scheduleRender()
    })
  }
}
