import { SelectionTool } from './contrib/select/selectionTool'
import { SelectionService } from './services/selection/selectionService'

import type { Editor } from '@latte-js/syrup'

export class Workbench {
  public readonly selectionService: SelectionService

  constructor(private readonly _editor: Editor) {
    this.selectionService = new SelectionService(this._editor.graph)
    const selectionTool = new SelectionTool(this.selectionService)
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
