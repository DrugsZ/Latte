import { SelectionTool } from './contrib/select/selectionTool'
import { SelectionService } from './services/selection/selectionService'
import { ToolService } from './services/tools/toolService'
import { PageService } from './services/page/pageService'

import type { EditorHost, IEditorRenderer, InputService } from '@latte-js/syrup'
import type { SceneGraph } from '@latte-js/espresso'
import type {
  IDocumentService,
  IDisposable,
  IQueryService,
} from '@latte-js/bean'

export interface WorkbenchOptions {
  editor: EditorHost<SceneGraph>
  inputService: InputService
  renderer: IEditorRenderer<SceneGraph>
  documentService: IDocumentService
  queryService: IQueryService
}

export class Workbench {
  public readonly selectionService: SelectionService
  public readonly toolService: ToolService
  public readonly pageService: PageService

  private readonly _editor: EditorHost<SceneGraph>
  private readonly _inputService: InputService
  private readonly _selectionTool: SelectionTool
  private _activeDocumentListener: IDisposable | null = null

  constructor(options: WorkbenchOptions) {
    this._editor = options.editor
    this._inputService = options.inputService
    this.selectionService = new SelectionService(this._editor.graph)
    this._selectionTool = new SelectionTool(this.selectionService)
    this.toolService = new ToolService(this._editor)
    this.pageService = new PageService(
      options.documentService,
      options.queryService,
      options.renderer
    )
    this._registerDefaultTools()
  }

  private _registerDefaultTools() {
    this._inputService.registerHandler(this.toolService)
    this._inputService.registerHandler(this._selectionTool)
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
    this._inputService.removeHandler(this.toolService.id)
    this._inputService.removeHandler(this._selectionTool.id)
    this.toolService.dispose()
    this.selectionService.clear()
  }
}

export const startWorkbench = (options: WorkbenchOptions) => {
  return new Workbench(options)
}
