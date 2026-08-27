import { type IDType } from '@latte-js/bean'
import { Disposable, Emitter, type Event } from '@latte-js/kit'

import type { IDocument } from './document'
import type { ServiceIdentifier } from '../services/instantiation/instantiation'

export type EditorHostServiceId<T = unknown> = ServiceIdentifier<T> | string

export interface IEditorRenderer<TGraph = unknown> {
  setGraph(graph: TGraph): void
  rebuildSceneIndex?(): void
  updateSceneIndexByIds?(ids: Iterable<IDType>): void
  fitToContent(rootId?: IDType, padding?: number): boolean
  requestRender(reason?: string): void
}

export class EditorHost<TGraph = unknown> extends Disposable {
  public static COUNT = 0

  public readonly id: string

  private _renderer: IEditorRenderer<TGraph> | null = null
  private readonly _defaultGraph: TGraph
  // FIXME(di): This is a temporary host-local registry. Move to typed service
  // identifiers and a ServiceCollection/ServicesAccessor before exposing it as
  // a stable platform or extension API.
  private readonly _services = new Map<EditorHostServiceId, unknown>()
  private readonly _documents: IDocument<TGraph>[] = []
  private _activeDocument: IDocument<TGraph> | null = null

  private readonly _onDidChangeActiveDocument = this._register(
    new Emitter<IDocument<TGraph> | null>()
  )
  public readonly onDidChangeActiveDocument: Event<IDocument<TGraph> | null> =
    this._onDidChangeActiveDocument.event

  constructor(private _graph: TGraph) {
    super()
    this._defaultGraph = _graph
    this.id = `editor_${EditorHost.COUNT++}`
  }

  public registerService<T>(id: EditorHostServiceId<T>, service: T): T {
    this._services.set(id, service)
    return service
  }

  public getService<T>(id: EditorHostServiceId<T>): T {
    const service = this._services.get(id)
    if (!service) {
      throw new Error(`[EditorHost] Service not found: ${String(id)}`)
    }
    return service as T
  }

  public hasService(id: EditorHostServiceId) {
    return this._services.has(id)
  }

  public addDocument(doc: IDocument<TGraph>, activate = true) {
    if (!this._documents.includes(doc)) {
      this._documents.push(doc)
    }

    if (activate) {
      this.setActiveDocument(doc)
    }

    return doc
  }

  public get documents() {
    return [...this._documents]
  }

  public get activeDocument() {
    return this._activeDocument
  }

  public setActiveDocument(doc: IDocument<TGraph> | null) {
    if (this._activeDocument === doc) {
      return
    }

    this._activeDocument = doc
    this.setGraph(doc?.graph ?? this._defaultGraph)

    this._onDidChangeActiveDocument.fire(doc)
  }

  public closeDocument(id: string) {
    const index = this._documents.findIndex(d => d.id === id)
    if (index === -1) {
      return
    }

    const [doc] = this._documents.splice(index, 1)
    if (this._activeDocument === doc) {
      this.setActiveDocument(
        this._documents[this._documents.length - 1] ?? null
      )
    }
  }

  public get graph() {
    return this._graph
  }

  public setGraph(graph: TGraph) {
    this._graph = graph
    this._renderer?.setGraph(graph)
  }

  public get renderer() {
    return this._renderer
  }

  public setRenderer(renderer: IEditorRenderer<TGraph> | null) {
    this._renderer = renderer
    this._renderer?.setGraph(this._graph)
  }
}
