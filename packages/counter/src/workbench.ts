import { SelectionTool } from './contrib/select/selectionTool'
import { SelectionOverlayLayer } from './overlay/selectionOverlayLayer'
import { SelectionService } from './services/selection/selectionService'
import { ToolService } from './services/tools/toolService'
import { PageService } from './services/page/pageService'

import { RenderReason, type RenderLayer } from '@latte-js/art'
import type { EditorHost, IInputService } from '@latte-js/syrup'
import type { SceneGraph } from '@latte-js/espresso'
import type {
  IDocumentService,
  IDisposable,
  IQueryService,
} from '@latte-js/bean'

export interface IRenderLayerHost {
  registerLayer(layer: RenderLayer): IDisposable
  requestRender(reason?: string): void
}

export interface WorkbenchOptions {
  editor: EditorHost<SceneGraph>
  inputService: IInputService
  renderer: IRenderLayerHost
  documentService: IDocumentService
  queryService: IQueryService
}

export class Workbench {
  public readonly selectionService: SelectionService
  public readonly toolService: ToolService
  public readonly pageService: PageService

  private readonly _editor: EditorHost<SceneGraph>
  private readonly _inputService: IInputService
  private readonly _renderer: IRenderLayerHost
  private readonly _selectionTool: SelectionTool
  private readonly _selectionOverlayLayer: SelectionOverlayLayer
  private _activeDocumentListener: IDisposable | null = null
  private _selectionChangeListener: IDisposable | null = null
  private _selectionOverlayLayerDisposable: IDisposable | null = null

  constructor(options: WorkbenchOptions) {
    this._editor = options.editor
    this._inputService = options.inputService
    this._renderer = options.renderer
    this.selectionService = new SelectionService(this._editor.graph)
    this._selectionTool = new SelectionTool(this.selectionService)
    this._selectionOverlayLayer = new SelectionOverlayLayer(
      this.selectionService
    )
    this.toolService = new ToolService(this._editor)
    this.pageService = new PageService(
      options.documentService,
      options.queryService
    )
    this._registerDefaultTools()
  }

  private _registerDefaultTools() {
    this._inputService.registerHandler(this.toolService)
    this._inputService.registerHandler(this._selectionTool)
    this._selectionOverlayLayerDisposable = this._renderer.registerLayer(
      this._selectionOverlayLayer
    )
    this._selectionChangeListener = this.selectionService.onSelectChange(() => {
      this._renderer.requestRender(RenderReason.LayerChanged)
    })
    this._activeDocumentListener = this._editor.onDidChangeActiveDocument(
      doc => {
        if (doc) {
          this.selectionService.setGraph(doc.graph)
        } else {
          this.selectionService.clear()
        }
      }
    )
  }

  public dispose() {
    this._activeDocumentListener?.dispose()
    this._activeDocumentListener = null
    this._selectionChangeListener?.dispose()
    this._selectionChangeListener = null
    this._selectionOverlayLayerDisposable?.dispose()
    this._selectionOverlayLayerDisposable = null
    this._inputService.removeHandler(this.toolService.id)
    this._inputService.removeHandler(this._selectionTool.id)
    this.toolService.dispose()
    this.pageService.dispose()
    this.selectionService.clear()
  }
}
