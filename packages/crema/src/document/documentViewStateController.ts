import { RenderReason } from '@latte-js/art'
import { NodeType, type IDType, type ILatteFile } from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'
import { Disposable } from '@latte-js/kit'
import type { EditorHost } from '@latte-js/syrup'

export interface IApplyDocumentViewStateOptions {
  readonly fitToContent?: boolean
}

export interface IRenderViewStateSink {
  setActiveRootId(rootId?: IDType | null): void
  fitToContent(rootId?: IDType, padding?: number): boolean
  requestRender(reason?: string): void
}

export class DocumentViewStateController extends Disposable {
  private readonly _activeRootIds = new Map<string, IDType>()

  constructor(
    private readonly _host: EditorHost<SceneGraph>,
    private readonly _renderViewState: IRenderViewStateSink
  ) {
    super()

    this._register(
      this._host.onDidChangeActiveDocument(doc => {
        if (doc) {
          this.applyActiveRoot(doc.id)
        } else {
          this._clearActiveRoot()
        }
      })
    )
  }

  public applyLoadedDocument(
    documentId: string,
    data: ILatteFile,
    options: IApplyDocumentViewStateOptions = {}
  ) {
    const activeRootId = this._findDefaultActiveRootId(data)
    this.setActiveRootId(documentId, activeRootId, options)
    return activeRootId
  }

  public setActiveRootId(
    documentId: string,
    activeRootId: IDType | undefined,
    options: IApplyDocumentViewStateOptions = {}
  ) {
    if (activeRootId) {
      this._activeRootIds.set(documentId, activeRootId)
    } else {
      this._activeRootIds.delete(documentId)
    }

    if (this._host.activeDocument?.id === documentId) {
      this.applyActiveRoot(documentId, options)
    }
  }

  public getActiveRootId(documentId: string) {
    return this._activeRootIds.get(documentId)
  }

  public clearDocument(documentId: string) {
    this._activeRootIds.delete(documentId)
  }

  public applyActiveRoot(
    documentId: string,
    options: IApplyDocumentViewStateOptions = {}
  ) {
    const activeRootId = this._activeRootIds.get(documentId)
    this._renderViewState.setActiveRootId(activeRootId)
    this._renderViewState.requestRender(RenderReason.ActiveRootChanged)
    if (!activeRootId) {
      return
    }

    if (options.fitToContent) {
      this._renderViewState.fitToContent(activeRootId)
      return
    }
  }

  public override dispose() {
    super.dispose()
    this._activeRootIds.clear()
  }

  private _findDefaultActiveRootId(data: ILatteFile): IDType | undefined {
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

  private _clearActiveRoot() {
    this._renderViewState.setActiveRootId(undefined)
    this._renderViewState.requestRender(RenderReason.ActiveRootChanged)
  }
}
