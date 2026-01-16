import RBush from 'rbush'
import { type SceneGraph, NodeCursor } from '@latte-js/espresso'
import type { IRenderBackend } from '../contract/renderBackend'
import type { Camera } from './camera'

export class Renderer {
  private _shouldRender = false
  private _testNumber = 0
  private _nodeCursor: NodeCursor
  private _rTree = new RBush()

  constructor(
    private _sceneGraph: SceneGraph,
    private _backend: IRenderBackend,
    private _camera: Camera
  ) {
    this._nodeCursor = new NodeCursor(this._sceneGraph, -1)
    this._buildRTree()
  }

  private _buildRTree() {
    this._rTree = new RBush()
  }

  private _render() {
    if (this._shouldRender === false) {
      return
    }
    this._clearRect()

    this._backend.beginFrame()

    // const index = this._sceneGraph.getIndex('test:1')

    this._nodeCursor.to(1)
    console.log(
      '🚀 ~ Renderer ~ _render ~ this._nodeCursor.x:',
      this._nodeCursor.x
    )
    console.log(
      '🚀 ~ Renderer ~ _render ~ this._nodeCursor.y:',
      this._nodeCursor.y
    )
    console.log(
      '🚀 ~ Renderer ~ _render ~ this._nodeCursor.width:',
      this._nodeCursor.width
    )
    console.log(
      '🚀 ~ Renderer ~ _render ~ this._nodeCursor.height:',
      this._nodeCursor.height
    )

    const matrix = this._camera.getMatrix()
    console.log('🚀 Camera matrix:', Array.from(matrix))
    console.log('🚀 Camera zoom:', this._camera.getZoom())
    console.log('🚀 Camera position:', this._camera.getPosition())
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

    console.log('🚀 ~ Renderer ~ _render ~ this._testNumber:', this._testNumber)
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
