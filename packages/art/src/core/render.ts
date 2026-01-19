import RBush from 'rbush'
import { type SceneGraph, NodeCursor } from '@latte-js/espresso'
import type { IRenderBackend } from '../contract/renderBackend'
import { Camera } from './camera'

export class Renderer {
  private _shouldRender = false
  private _testNumber = 0
  private _nodeCursor: NodeCursor
  private _camera: Camera
  private _rTree = new RBush()

  constructor(
    private _sceneGraph: SceneGraph,
    private _backend: IRenderBackend,
    private _container: HTMLCanvasElement
  ) {
    this._nodeCursor = new NodeCursor(this._sceneGraph, -1)
    this._initCamera(this._container)
    this._initRenderBackend(this._container)
    this._initObserver(this._container)
    this._buildRTree()
    this.start()
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

  private _actualRender() {
    if (this._shouldRender === false) {
      return
    }
    this._clearRect()

    this._backend.beginFrame()

    // const index = this._sceneGraph.getIndex('test:1')

    this._nodeCursor.to(1)

    const matrix = this._camera.getMatrix()
    this._backend.setTransform(new Float32Array(matrix))

    this._backend.drawRect(
      this._nodeCursor.x,
      this._nodeCursor.y,
      this._nodeCursor.width,
      this._nodeCursor.height,
      0,
      0xffffffff,
      255,
      1
    )
    this._backend.drawText(
      `testtest${this._testNumber++}`,
      this._nodeCursor.x,
      this._nodeCursor.y,
      'serif',
      14,
      0x000000ff
    )

    this._backend.drawRect(-10, -1, 20, 2, 0, 0xff0000ff)
    this._backend.drawRect(-1, -10, 2, 20, 0, 0xff0000ff)

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
      this._actualRender()
      this._scheduleRender()
    })
  }
}
