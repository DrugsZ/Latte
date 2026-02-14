import { Canvas2DRender, Renderer } from '@latte-js/art'
import { BaristaClient } from '@latte-js/barista'
import BaristaWorker from '@latte-js/barista/worker?worker'
import {
  DEFAULT_HEAP_SIZE,
  MAX_NODES,
  SceneGraph,
  TOTAL_MEMORY_BYTES,
} from '@latte-js/espresso'
import { Emitter } from '@latte-js/kit'
import { Channels } from '@latte-js/bean'

import {
  InputService,
  EventResult,
  InputMouseEvent,
} from '../services/input/inputService'
import { LatteDocument, type IDocument } from './document'
import { ContextMenu } from '../services/contextmenu/contextMenu'
import {
  ContextMenuService,
  IContextMenuService,
} from '../services/contextmenu/contextMenuService'
import {
  ContextViewService,
  IContextViewService,
} from '../services/contextview/contextViewService'
import { MenuService, IMenuService } from '../services/menu/menuService'
import { CommandService } from '../services/command/commandService'
import { ICommandService } from '../services/command/commandsRegistry'

export class Editor {
  public static COUNT = 0
  public readonly id: string
  private _graph: SceneGraph
  public _renderer: Renderer
  public worker: Worker
  public inputService: InputService
  public contextMenu: ContextMenu
  private _baristaClient: BaristaClient
  private _services = new Map<string, any>()
  private _documents: IDocument[] = []
  private _activeDocument: IDocument | null = null

  private readonly _onDidChangeActiveDocument = new Emitter<IDocument | null>()
  public readonly onDidChangeActiveDocument =
    this._onDidChangeActiveDocument.event

  constructor() {
    this.id = `editor_${Editor.COUNT++}`
    const sharedBuffer = new SharedArrayBuffer(TOTAL_MEMORY_BYTES)
    const allocBuffer = new SharedArrayBuffer(MAX_NODES)
    const heapBuffer = new SharedArrayBuffer(DEFAULT_HEAP_SIZE)
    this._graph = new SceneGraph(sharedBuffer, allocBuffer, heapBuffer)
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

  public get activeDocument() {
    return this._activeDocument
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

    const commandService = new CommandService()
    const menuService = new MenuService()
    const contextViewService = new ContextViewService(commandService)
    const contextMenuService = new ContextMenuService(contextViewService)

    this.contextMenu = new ContextMenu(contextMenuService, menuService)

    this._services.set('commandService', commandService)
    this._services.set('menuService', menuService)
    this._services.set('contextViewService', contextViewService)
    this._services.set('contextMenuService', contextMenuService)

    this.inputService.registerHandler({
      id: 'contextMenu',
      priority: 100,
      onEvent: e => {
        if (e.browserEvent?.type === 'contextmenu') {
          const hitResult =
            e instanceof InputMouseEvent ? e.hitResult : undefined
          this.contextMenu.showContextMenu(
            {
              x: e.browserEvent.clientX,
              y: e.browserEvent.clientY,
            },
            hitResult
          )
          return EventResult.CONSUMED
        }
        return EventResult.IGNORED
      },
    })

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
