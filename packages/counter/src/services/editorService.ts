import { IContextService } from '@latte-js/bean'
import { Emitter } from '@latte-js/kit'
import { editor, LatteDocument, type IDocument } from '@latte-js/syrup'

export class EditorService implements IContextService {
  private _documents: IDocument[] = []
  private _activeDocument: IDocument | null = null

  private readonly _onDidChangeActiveDocument = new Emitter<IDocument | null>()
  public readonly onDidChangeActiveDocument =
    this._onDidChangeActiveDocument.event

  constructor() {
    editor.registerService(IContextService, this)
  }

  public getContextId() {
    return this._activeDocument?.id ?? null
  }

  public get documents() {
    return this._documents
  }

  public get activeDocument() {
    return this._activeDocument
  }

  public async openDocument(id: string, uri: string) {
    const doc = new LatteDocument(id, uri)

    await editor.baristaClient.initSession(
      doc.id,
      doc.graph.buffer,
      doc.graph.allocator.buffer
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
      editor.setGraph(doc.graph)
      editor.baristaClient.setTargetSession(doc.id)
    } else {
      editor.baristaClient.setTargetSession(null)
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
}

export const editorService = new EditorService()
