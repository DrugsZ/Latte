import { SelectionTool } from './contrib/select/selectionTool'
import { SelectionService } from './services/selection/selectionService'
import { ToolService } from './services/tools/toolService'
import { PageService } from './services/page/pageService'

import type { Editor } from '@latte-js/syrup'
import { Channels } from '@latte-js/bean'

export class Workbench {
  public readonly selectionService: SelectionService
  public readonly toolService: ToolService
  public readonly pageService: PageService
  constructor(private readonly _editor: Editor) {
    this.selectionService = new SelectionService(this._editor.graph)
    this.toolService = new ToolService()
    this.pageService = new PageService(
      this._editor.baristaClient.getService(Channels.Document),
      this._editor.baristaClient.getService(Channels.Query)
    )
    this._registerDefaultTools()
  }

  private _registerDefaultTools() {
    const selectionTool = new SelectionTool(this.selectionService)
    this._editor.inputService.registerHandler(this.toolService)
    this._editor.inputService.registerHandler(selectionTool)
    this._editor.onDidChangeActiveDocument(doc => {
      if (doc) {
        this.selectionService.setGraph(doc.graph)
      } else {
        this.selectionService.clear()
      }
    })
  }
}

export const startWorkbench = (editor: Editor) => {
  return new Workbench(editor)
}
