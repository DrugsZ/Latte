import { SceneGraph, TOTAL_MEMORY_BYTES, MAX_NODES } from '@latte-js/espresso'
import { BaristaClient } from '@latte-js/barista'
import { Canvas2DRender, Renderer } from '@latte-js/art'
import BaristaWorker from '@latte-js/barista/worker?worker'

export class Editor {
  public readonly graph: SceneGraph
  public _renderer: Renderer
  public worker: Worker
  private _baristaClient: BaristaClient

  constructor() {
    const sharedBuffer = new SharedArrayBuffer(TOTAL_MEMORY_BYTES)
    const allocBuffer = new SharedArrayBuffer(MAX_NODES)

    this.graph = new SceneGraph(sharedBuffer, allocBuffer)
  }

  public get baristaClient() {
    return this._baristaClient
  }

  public async startup(canvas: HTMLCanvasElement) {
    this.worker = new BaristaWorker()
    this._baristaClient = new BaristaClient(this.worker)
    const initResult = await this._baristaClient.init(
      this.graph.buffer,
      this.graph.allocator.buffer
    )

    await this._initRenderer(canvas)

    return initResult
  }

  public get renderer() {
    return this._renderer
  }

  private _initRenderer(canvas: HTMLCanvasElement) {
    this._renderer = new Renderer(this.graph, new Canvas2DRender(), canvas)
  }
}

export const editor = new Editor()
