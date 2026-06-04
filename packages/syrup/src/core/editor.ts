import '../vite-env.d.ts'

import { Canvas2DRender, Renderer } from '@latte-js/art'
import { BaristaClient } from '@latte-js/barista'
import BaristaWorker from '@latte-js/barista/worker?worker'
import { LatteLoader, SceneGraph } from '@latte-js/espresso'
import { Emitter } from '@latte-js/kit'

import { InputService } from '../services/input/inputService'
import { LatteDocument, type IDocument } from './document'

import { NodeType, type IDType, type ILatteFile } from '@latte-js/bean'

export class Editor {
  public static COUNT = 0
  public readonly id: string
  private _graph: SceneGraph
  public _renderer: Renderer
  public worker: Worker
  public inputService: InputService
  private _baristaClient: BaristaClient
  private _services = new Map<string, any>()
  private _documents: IDocument[] = []
  private _activeDocument: IDocument | null = null

  private readonly _onDidChangeActiveDocument = new Emitter<IDocument | null>()
  public readonly onDidChangeActiveDocument =
    this._onDidChangeActiveDocument.event

  constructor() {
    this.id = `editor_${Editor.COUNT++}`
    this._graph = new SceneGraph()
  }

  public getService<T>(id: string): T {
    const service = this._services.get(id)
    if (!service) {
      throw new Error(`[Editor] Service not found: ${id}`)
    }
    return service
  }

  public async openDocument(id: string, uri: string) {
    const doc = new LatteDocument(id, uri)

    await this.baristaClient.initSession(
      doc.id,
      doc.graph.buffer,
      doc.graph.allocator.buffer,
      doc.graph.heap.buffer
    )

    this._documents.push(doc)
    this.setActiveDocument(doc)
    return doc
  }

  public setActiveDocument(doc: IDocument | null) {
    if (this._activeDocument === doc) {
      return
    }

    this._activeDocument = doc
    if (doc) {
      this.setGraph(doc.graph)
      this.baristaClient.setTargetSession(doc.id)
    } else {
      this.baristaClient.setTargetSession(null)
    }

    this._onDidChangeActiveDocument.fire(doc)
  }

  public closeDocument(id: string) {
    const index = this._documents.findIndex(d => d.id === id)
    if (index !== -1) {
      const [doc] = this._documents.splice(index, 1)
      if (this._activeDocument === doc) {
        this.setActiveDocument(
          this._documents[this._documents.length - 1] || null
        )
      }
      // TODO: destroy session in barista
    }
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

    const initResult = await this._baristaClient.init(
      this._graph.buffer,
      this._graph.allocator.buffer,
      this._graph.heap.buffer
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

  public hydrateDocument(data: ILatteFile, idMap?: Map<IDType, number>) {
    if (idMap) {
      this._graph.resetUUIDMap(idMap)
    } else {
      const loader = new LatteLoader(this._graph)
      idMap = loader.load(data)
    }

    const activeRootId = this._findActiveRootId(data)

    if (activeRootId && this._renderer) {
      this._renderer.setActiveRootId(activeRootId)
      this._renderer.fitToContent(activeRootId)
    }

    this._renderer?.requestRender()

    return { idMap, activeRootId }
  }

  public get renderer() {
    return this._renderer
  }

  private _initRenderer(container: HTMLDivElement) {
    this._renderer = new Renderer(this._graph, new Canvas2DRender(), container)
    this.inputService = new InputService(this._renderer, this._graph)
  }

  private _findActiveRootId(data: ILatteFile): IDType | undefined {
    const page = data.elements.find(node => {
      const type = node.type as string | number
      return type === 'CANVAS' || type === NodeType.CANVAS
    })
    if (page) {
      return page.guid
    }

    const document = data.elements.find(node => {
      const type = node.type as string | number
      return type === 'DOCUMENT' || type === NodeType.DOCUMENT
    })
    return document?.guid
  }
}

export const editor = new Editor()
