import {
  type IDocumentService,
  type IDisposable,
  type IQueryService,
  type IDType,
  NodeType,
} from '@latte-js/bean'

export class PageService {
  private _activePageId: IDType | null = null
  private _documentListener: IDisposable | null = null

  constructor(
    private _documentService: IDocumentService,
    private _queryService: IQueryService
  ) {
    this._listenDocumentChanges()
  }

  public get activePageId(): IDType | null {
    return this._activePageId
  }

  private async _resetActivePageId() {
    const allPages = await this._queryService.getElementsByType(NodeType.CANVAS)
    this._activePageId = allPages.length > 0 ? allPages[0] : null
  }

  private _listenDocumentChanges() {
    this._documentListener = this._documentService.onLoad(async () => {
      await this._resetActivePageId()
    })
  }

  public dispose() {
    this._documentListener?.dispose()
    this._documentListener = null
  }
}
