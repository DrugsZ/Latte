import RBush from 'rbush'
import { type SceneGraph, NodeCursor, NULL_INDEX } from '@latte-js/espresso'
import type { IRenderBackend } from '../contract/renderBackend'
import { Camera } from './camera'
import type { IDType } from '@latte-js/bean'
import { mat2d } from 'gl-matrix'
import { getRenderer } from './rendererRegistry'

export class Renderer {
  private _shouldRender = false
  private _camera: Camera
  private _tempMatrix: mat2d = mat2d.create()
  private _rTree = new RBush()

  constructor(
    private _sceneGraph: SceneGraph,
    private _backend: IRenderBackend,
    private _container: HTMLCanvasElement,
    private _activeRootId?: IDType
  ) {
    this._initCamera(this._container)
    this._initRenderBackend(this._container)
    this._initObserver(this._container)
    this._buildRTree()
    this.start()
  }

  public setActiveRootId(rootId: IDType) {
    this._activeRootId = rootId
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

  private _initCamera(container: HTMLCanvasElement) {
    const rect = container.getBoundingClientRect()
    this._camera = new Camera(rect.width, rect.height)
    this._camera.fitBounds(-100, -100, rect.right * 2, rect.bottom * 2, 0)

    this._camera.onDidChange(() => {
      this.requestRender()
    })
  }

  public get camera() {
    return this._camera
  }

  private _initRenderBackend(container: HTMLCanvasElement) {
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this._backend.init(container, dpr)
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
    const rootIndex = this._sceneGraph.getIndex(this._activeRootId!)
    stack.push(rootIndex)
    let current

    while (stack.length) {
      current = stack.pop()!
      visibleNodes.push(current)
      current = this._sceneGraph.firstChild[current]
      const child: number[] = []
      while (current !== NULL_INDEX) {
        child.push(current)
        current = this._sceneGraph.nextSibling[current]
      }
      if (child.length) {
        stack.push(...child.reverse())
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

  private _actualRender() {
    this._clearRect()

    this._backend.beginFrame()

    const visibleNodeIds = this._getAllVisibleNodeIds()

    const matrix = this._camera.getMatrix()
    const node = new NodeCursor(this._sceneGraph, -1)
    for (const id of visibleNodeIds) {
      node.to(id)
      mat2d.multiply(this._tempMatrix, matrix, node.worldTransform)
      this._backend.setTransform(new Float32Array(this._tempMatrix))

      const renderer = getRenderer(node.type)
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
