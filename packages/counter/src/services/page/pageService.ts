import {
  type IDocumentService,
  type IDisposable,
  type IQueryService,
  type IDType,
  NodeType,
} from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'
import type { EditorHost } from '@latte-js/syrup'

export interface PageServiceOptions {
  readonly editor: EditorHost<SceneGraph>
  readonly getDocumentService: (sessionId: string) => IDocumentService
  readonly getQueryService: (sessionId: string) => IQueryService
}

export class PageService {
  private _activePageId: IDType | null = null
  private _activeDocumentListener: IDisposable | null = null
  private _documentListener: IDisposable | null = null
  private _bindingVersion = 0

  constructor(private readonly _options: PageServiceOptions) {
    this._activeDocumentListener =
      this._options.editor.onDidChangeActiveDocument(document => {
        this._bindDocument(document?.id ?? null)
      })
    this._bindDocument(this._options.editor.activeDocument?.id ?? null)
  }

  public get activePageId(): IDType | null {
    return this._activePageId
  }

  private async _resetActivePageId(
    queryService: IQueryService,
    bindingVersion: number
  ) {
    const allPages = await queryService.getElementsByType(NodeType.CANVAS)
    if (bindingVersion === this._bindingVersion) {
      this._activePageId = allPages.length > 0 ? allPages[0] : null
    }
  }

  private _bindDocument(sessionId: string | null) {
    this._documentListener?.dispose()
    this._documentListener = null
    this._activePageId = null
    const bindingVersion = ++this._bindingVersion

    if (!sessionId) {
      return
    }

    const documentService = this._options.getDocumentService(sessionId)
    const queryService = this._options.getQueryService(sessionId)
    this._documentListener = documentService.onLoad(() => {
      void this._resetActivePageId(queryService, bindingVersion)
    })
    void this._resetActivePageId(queryService, bindingVersion)
  }

  public dispose() {
    this._activeDocumentListener?.dispose()
    this._activeDocumentListener = null
    this._documentListener?.dispose()
    this._documentListener = null
    this._activePageId = null
    this._bindingVersion++
  }
}
