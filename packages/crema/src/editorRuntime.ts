import { Canvas2DRender, Renderer } from '@latte-js/art'
import { BaristaClient } from '@latte-js/barista'
import BaristaWorker from '@latte-js/barista/worker?worker'
import { Channels, type ILatteFile } from '@latte-js/bean'
import { startWorkbench, type Workbench } from '@latte-js/counter'
import { SceneGraph } from '@latte-js/espresso'
import {
  EditorHost,
  IInputService,
  InputService,
  LatteDocument,
} from '@latte-js/syrup'

import { TransformInteractionController } from './interactions/transformInteractionController'
import { RendererInputHitTestProvider } from './input/rendererInputHitTestProvider'
import { ProjectionSyncController } from './projection/projectionSyncController'

const WORKER_SERVICE_CHANNELS = [
  Channels.Node,
  Channels.Transform,
  Channels.Scene,
  Channels.Document,
  Channels.Query,
  Channels.UndoRedo,
] as const

// FIXME(di): Replace channel-string service registration with typed service
// identifiers once syrup has a ServiceCollection/InstantiationService. Crema
// should remain the composition root that wires local services and RPC proxies.

export class EditorRuntime {
  private _transformInteraction: TransformInteractionController | null = null
  private _projection: ProjectionSyncController | null = null
  private _worker: Worker | null = null
  private _baristaClient: BaristaClient | null = null
  private _renderer: Renderer | null = null
  private _inputService: InputService | null = null
  private _workbench: Workbench | null = null
  private _started = false

  constructor(
    public readonly editorHost: EditorHost<SceneGraph> = new EditorHost(
      new SceneGraph()
    )
  ) {}

  public get transformInteraction() {
    if (!this._transformInteraction) {
      const transformService = this.baristaClient.getService(Channels.Transform)
      this._transformInteraction = new TransformInteractionController(
        transformService
      )
    }
    return this._transformInteraction
  }

  public get projection() {
    if (!this._projection) {
      throw new Error('[EditorRuntime] projection is not ready')
    }
    return this._projection
  }

  public get baristaClient() {
    if (!this._baristaClient) {
      throw new Error('[EditorRuntime] barista client is not ready')
    }
    return this._baristaClient
  }

  public get renderer() {
    if (!this._renderer) {
      throw new Error('[EditorRuntime] renderer is not ready')
    }
    return this._renderer
  }

  public get inputService() {
    if (!this._inputService) {
      throw new Error('[EditorRuntime] input service is not ready')
    }
    return this._inputService
  }

  public get workbench() {
    return this._workbench
  }

  public async startup(container: HTMLDivElement) {
    if (this._started) {
      throw new Error('[EditorRuntime] startup has already been called')
    }

    const worker = new BaristaWorker()
    this._worker = worker
    this._baristaClient = new BaristaClient(worker)

    const result = await this._baristaClient.init(
      this.editorHost.graph.buffer,
      this.editorHost.graph.allocator.buffer,
      this.editorHost.graph.heap.buffer
    )

    this._registerWorkerServices()
    this._renderer = new Renderer(
      this.editorHost.graph,
      new Canvas2DRender(),
      container
    )
    this.editorHost.setRenderer(this._renderer)

    this._inputService = new InputService(
      this._renderer.canvas,
      new RendererInputHitTestProvider(this.editorHost, this._renderer)
    )
    this.editorHost.registerService(IInputService, this._inputService)

    this._projection = new ProjectionSyncController(
      this.editorHost,
      this._baristaClient.getService(Channels.Node),
      this._baristaClient.getService(Channels.Scene)
    )
    this._projection.start()

    this._workbench = startWorkbench({
      editor: this.editorHost,
      inputService: this._inputService,
      renderer: this._renderer,
      documentService: this._baristaClient.getService(Channels.Document),
      queryService: this._baristaClient.getService(Channels.Query),
    })

    this._started = true
    return result
  }

  public async loadDocument(data: ILatteFile) {
    this._assertStarted()

    const documentService = this.baristaClient.getService(Channels.Document)
    const idMap = await documentService.load(data)
    return this.projection.applyLoadedDocument(data, idMap)
  }

  // FIXME(document-service): This is a transition helper while runtime owns
  // BaristaClient and graph/session wiring. Move document open/close/switch
  // orchestration to a typed main-thread EditorDocumentService or
  // EditorSessionService once syrup has ServiceCollection/ServicesAccessor.
  public async openDocument(id: string, uri: string) {
    this._assertStarted()

    const doc = new LatteDocument(id, uri, new SceneGraph())
    await this.baristaClient.initSession(
      doc.id,
      doc.graph.buffer,
      doc.graph.allocator.buffer,
      doc.graph.heap.buffer
    )
    this.editorHost.addDocument(doc, false)
    this.setActiveDocument(doc.id)
    return doc
  }

  public setActiveDocument(id: string | null) {
    const doc =
      id === null
        ? null
        : (this.editorHost.documents.find(document => document.id === id) ??
          null)

    this.baristaClient.setTargetSession(doc?.id ?? null)
    this.editorHost.setActiveDocument(doc)
  }

  public dispose() {
    this._transformInteraction?.dispose()
    this._transformInteraction = null

    this._projection?.dispose()
    this._projection = null

    this._workbench?.dispose()
    this._workbench = null

    this._inputService?.dispose()
    this._inputService = null

    this._renderer?.dispose()
    this._renderer = null

    this.editorHost.setRenderer(null)
    this._worker?.terminate()
    this._worker = null
    this._baristaClient = null
    this._started = false
  }

  private _registerWorkerServices() {
    for (const channel of WORKER_SERVICE_CHANNELS) {
      this.editorHost.registerService(
        channel,
        this.baristaClient.getService(channel)
      )
    }
  }

  private _assertStarted() {
    if (!this._started) {
      throw new Error('[EditorRuntime] startup must be called first')
    }
  }
}
