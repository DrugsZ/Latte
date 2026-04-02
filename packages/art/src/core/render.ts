import { type SceneGraph, NodeCursor, NULL_INDEX } from '@latte-js/espresso'
import { mat2d } from 'gl-matrix'
import RBush from 'rbush'

import { Camera } from './camera'
import { getRenderer } from './rendererRegistry'

import type { IDType } from '@latte-js/bean'
import type { IRenderBackend } from '../contract/renderBackend'

export class Renderer {
  private _shouldRender = false
  private _camera: Camera
  private _tempMatrix: mat2d = mat2d.create()
  private _rTree = new RBush()
  private _canvas: HTMLCanvasElement

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
    this._buildRTree()
    this.start()
  }

  public get rTree() {
    return this._rTree
  }

  public get canvas() {
    return this._canvas
  }

  public setActiveRootId(rootId: IDType) {
    this._activeRootId = rootId
    this.requestRender()
  }

  public setGraph(graph: SceneGraph) {
    this._sceneGraph = graph
    this._buildRTree()
    this.requestRender()
  }

  get activeRootId() {
    return this._activeRootId
  }

  public resize(width: number, height: number) {
    this._backend.resize(width, height, window.devicePixelRatio)

    this.camera.resize(width, height)
  }

  private _initObserver(container: HTMLCanvasElement) {
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      this.resize(width, height)
    })
    observer.observe(container)
  }

  private _initCamera() {
    const rect = this._container.getBoundingClientRect()
    this._camera = new Camera(rect.width, rect.height)
    this._camera.fitBounds(-100, -100, rect.right * 2, rect.bottom * 2, 0)

    this._camera.onDidChange(() => {
      this.requestRender()
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

  public requestRender() {
    this._shouldRender = true
  }

  private _buildRTree() {
    this._rTree = new RBush()
  }

  private _getAllVisibleNodeIds() {
    const visibleNodes: number[] = []
    const stack: number[] = []
    if (!this._activeRootId) return visibleNodes

    const rootIndex = this._sceneGraph.getIndex(this._activeRootId)
    if (rootIndex === NULL_INDEX) return visibleNodes

    stack.push(rootIndex)
    const visited = new Set<number>()
    let current

    while (stack.length) {
      current = stack.pop()!
      if (visited.has(current)) continue
      visited.add(current)

      visibleNodes.push(current)

      let childIdx = this._sceneGraph.firstChild[current]
      const children: number[] = []
      const childVisited = new Set<number>()
      while (
        childIdx !== NULL_INDEX &&
        childIdx !== undefined &&
        !childVisited.has(childIdx)
      ) {
        childVisited.add(childIdx)
        children.push(childIdx)
        childIdx = this._sceneGraph.nextSibling[childIdx]
      }
      if (children.length) {
        stack.push(...children.reverse())
      }
    }

    return visibleNodes
  }

  private _render() {
    if (this._shouldRender === false || !this._activeRootId) {
      return
    }
    this._actualRender()
  }

  private _renderOverlay() {
    //FIXME: implement overlay render logic
  }

  private _actualRender() {
    const matrix = this._camera.getMatrix()
    this._backend.setTransform(new Float32Array([1, 0, 0, 1, 0, 0]))
    this._clearRect()

    this._backend.beginFrame()

    const visibleNodeIds = this._getAllVisibleNodeIds()
    const node = new NodeCursor(this._sceneGraph, -1)
    this._rTree.clear()
    const rTreeItems: {
      minX: number
      minY: number
      maxX: number
      maxY: number
      id: number
    }[] = []
    for (const id of visibleNodeIds) {
      node.to(id)
      const { width, height, worldTransform: wt } = node
      const a = wt[0]
      const b = wt[1]
      const c = wt[2]
      const d = wt[3]
      const tx = wt[4]
      const ty = wt[5]

      const cx = width / 2
      const cy = height / 2

      // Calculate translation adjusted for center-pivot rotation
      // Standard WT is T(tx, ty) * R_topleft.
      // Center-pivot WT is T(tx, ty) * T(cx, cy) * R * T(-cx, -cy)
      // = T(tx + cx - (a*cx + c*cy), ty + cy - (b*cx + d*cy)) * R
      const ntx = tx + cx - (a * cx + c * cy)
      const nty = ty + cy - (b * cx + d * cy)

      mat2d.set(this._tempMatrix, a, b, c, d, ntx, nty)

      // Calculate world-space AABB for R-Tree based on the new pivot-adjusted transform
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      const corners = [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
      ]
      for (const [lx, ly] of corners) {
        const wx = a * lx + c * ly + ntx
        const wy = b * lx + d * ly + nty
        minX = Math.min(minX, wx)
        minY = Math.min(minY, wy)
        maxX = Math.max(maxX, wx)
        maxY = Math.max(maxY, wy)
      }

      rTreeItems.push({
        minX,
        minY,
        maxX,
        maxY,
        id,
      })

      // Combine with camera matrix for rendering
      mat2d.multiply(this._tempMatrix, matrix, this._tempMatrix)

      if (node.id === '19:4') {
        console.log(node.x, node.y)
      }
      this._backend.setTransform(new Float32Array(this._tempMatrix))

      const renderer = getRenderer(node.type)
      if (renderer) {
        renderer.render(this._backend, node)
      }
    }

    if (rTreeItems.length > 0) {
      this._rTree.load(rTreeItems)
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
    this._shouldRender = false
  }

  public renderFrame() {
    this._shouldRender = true
  }

  public start() {
    this._scheduleRender()
  }

  public dispose() {
    this._shouldRender = false
    this._backend.dispose()
  }

  private _clearRect() {
    this._backend.clearRect(
      0,
      0,
      this._backend.getWidth(),
      this._backend.getHeight()
    )
  }

  private _scheduleRender() {
    requestAnimationFrame(() => {
      this._render()
      this._scheduleRender()
    })
  }
}
