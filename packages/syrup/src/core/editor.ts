import { Canvas2DRender, Renderer } from '@latte-js/art'
import { BaristaClient } from '@latte-js/barista'
import BaristaWorker from '@latte-js/barista/worker?worker'
import {
  DEFAULT_SCENE_GRAPH_NAME,
  IContextService,
  IRpcService,
} from '@latte-js/bean'
import { MAX_NODES, SceneGraph, TOTAL_MEMORY_BYTES } from '@latte-js/espresso'

import { InputService } from '../services/inputService'

export class Editor {
  public static COUNT = 0
  public readonly id: string
  private _graph: SceneGraph
  public _renderer: Renderer
  public worker: Worker
  public inputService: InputService
  private _baristaClient: BaristaClient
  private _services = new Map<string, any>()

  constructor() {
    this.id = `editor_${Editor.COUNT++}`
    // Create a default graph to start with
    const sharedBuffer = new SharedArrayBuffer(TOTAL_MEMORY_BYTES)
    const allocBuffer = new SharedArrayBuffer(MAX_NODES)
    this._graph = new SceneGraph(sharedBuffer, allocBuffer)

    // Default context service
    this.registerService(IContextService, {
      getContextId: () => DEFAULT_SCENE_GRAPH_NAME,
    })
  }

  public registerService(id: string, service: any) {
    this._services.set(id, service)
  }

  public getService<T>(id: string): T {
    const service = this._services.get(id)
    if (!service) {
      throw new Error(`[Editor] Service not found: ${id}`)
    }
    return service
  }

  public get graph() {
    return this._graph
  }

  public get baristaClient() {
    return this._baristaClient
  }

  public async startup(container: HTMLDivElement) {
    this.worker = new BaristaWorker()
    this._baristaClient = new BaristaClient(this.worker)
    this.registerService(IRpcService, this._baristaClient)

    const initResult = await this._baristaClient.init(
      this._graph.buffer,
      this._graph.allocator.buffer
    )

    await this._initRenderer(container)

    return initResult
  }

  public setGraph(graph: SceneGraph) {
    this._graph = graph
    if (this._renderer) {
      this._renderer.setGraph(graph)
    }
    if (this.inputService) {
      this.inputService.setGraph(graph)
    }
  }

  public get renderer() {
    return this._renderer
  }

  private _initRenderer(container: HTMLDivElement) {
    this._renderer = new Renderer(this._graph, new Canvas2DRender(), container)
    this.inputService = new InputService(this._renderer, this._graph)
  }
}

export const editor = new Editor()
