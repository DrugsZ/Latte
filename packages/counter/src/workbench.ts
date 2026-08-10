import { RectangleTool } from './contrib/create/rectangleTool'
import {
  SelectionInteractionTool,
  type ISelectionTransformInteraction,
} from './interactions/selectionOverlayInteractionTool'
import { CreationPreviewLayer } from './overlay/creationPreviewLayer'
import { CreationPreviewStore } from './overlay/creationPreviewState'
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
  INodeService,
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
  transformInteraction: ISelectionTransformInteraction
  getDocumentService: (sessionId: string) => IDocumentService
  nodeService: INodeService
  getQueryService: (sessionId: string) => IQueryService
}

export class Workbench {
  public readonly selectionService: SelectionService
  public readonly creationPreviewStore: CreationPreviewStore
  public readonly toolService: ToolService
  public readonly pageService: PageService

  private readonly _editor: EditorHost<SceneGraph>
  private readonly _inputService: IInputService
  private readonly _renderer: IRenderLayerHost
  private readonly _rectangleTool: RectangleTool
  private readonly _selectionInteractionTool: SelectionInteractionTool
  private readonly _creationPreviewLayer: CreationPreviewLayer
  private readonly _selectionOverlayLayer: SelectionOverlayLayer
  private _activeDocumentListener: IDisposable | null = null
  private _selectionChangeListener: IDisposable | null = null
  private _creationPreviewChangeListener: IDisposable | null = null
  private _creationPreviewLayerDisposable: IDisposable | null = null
  private _selectionOverlayLayerDisposable: IDisposable | null = null

  constructor(options: WorkbenchOptions) {
    this._editor = options.editor
    this._inputService = options.inputService
    this._renderer = options.renderer
    this.selectionService = new SelectionService(this._editor.graph)
    this.creationPreviewStore = new CreationPreviewStore()
    this.pageService = new PageService({
      editor: this._editor,
      getDocumentService: options.getDocumentService,
      getQueryService: options.getQueryService,
    })
    this._rectangleTool = new RectangleTool({
      nodeService: options.nodeService,
      selectionService: this.selectionService,
      previewStore: this.creationPreviewStore,
      getParentId: () => this.pageService.activePageId,
    })
    this._selectionInteractionTool = new SelectionInteractionTool(
      options.transformInteraction,
      {
        getSelectedIds: () => this.selectionService.ids,
        selectIds: ids => this.selectionService.select(ids),
        toggleId: id => this.selectionService.toggle(id),
        clearSelection: () => this.selectionService.clear(),
      }
    )
    this._creationPreviewLayer = new CreationPreviewLayer(
      this.creationPreviewStore
    )
    this._selectionOverlayLayer = new SelectionOverlayLayer(
      this.selectionService
    )
    this.toolService = new ToolService(this._editor)
    this._registerDefaultTools()
  }

  private _registerDefaultTools() {
    this._inputService.registerHandler(this.toolService)
    this._inputService.registerHandler(this._selectionInteractionTool)
    this.toolService.registerTool(this._rectangleTool)
    this._creationPreviewLayerDisposable = this._renderer.registerLayer(
      this._creationPreviewLayer
    )
    this._selectionOverlayLayerDisposable = this._renderer.registerLayer(
      this._selectionOverlayLayer
    )
    this._creationPreviewChangeListener = this.creationPreviewStore.onDidChange(
      () => {
        this._renderer.requestRender(RenderReason.LayerChanged)
      }
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
    this._creationPreviewChangeListener?.dispose()
    this._creationPreviewChangeListener = null
    this._creationPreviewLayerDisposable?.dispose()
    this._creationPreviewLayerDisposable = null
    this._selectionOverlayLayerDisposable?.dispose()
    this._selectionOverlayLayerDisposable = null
    this._inputService.removeHandler(this.toolService.id)
    this._inputService.removeHandler(this._selectionInteractionTool.id)
    this.toolService.dispose()
    this.pageService.dispose()
    this.selectionService.clear()
  }
}
