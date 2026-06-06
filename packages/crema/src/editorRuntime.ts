import { Channels, type ILatteFile } from '@latte-js/bean'
import type { Editor } from '@latte-js/syrup'
import { editor as defaultEditor } from '@latte-js/syrup'

import { RuntimeInteractionController } from './interactions/runtimeInteractionController'
import { ProjectionSyncController } from './projection/projectionSyncController'

export class EditorRuntime {
  private _interactions: RuntimeInteractionController | null = null
  private _projection: ProjectionSyncController
  private _started = false

  constructor(public readonly editor: Editor = defaultEditor) {
    this._projection = new ProjectionSyncController(editor)
  }

  public get interactions() {
    if (!this._interactions) {
      const transformService = this.editor.baristaClient.getService(
        Channels.Transform
      )
      const undoRedoService = this.editor.baristaClient.getService(
        Channels.UndoRedo
      )
      this._interactions = new RuntimeInteractionController(
        transformService,
        undoRedoService
      )
    }
    return this._interactions
  }

  public get projection() {
    return this._projection
  }

  public async startup(container: HTMLDivElement) {
    const result = await this.editor.startup(container)
    this._started = true
    this._projection.start()
    return result
  }

  public async loadDocument(data: ILatteFile) {
    this._assertStarted()

    const documentService = this.editor.baristaClient.getService(
      Channels.Document
    )
    const idMap = await documentService.load(data)
    return this._projection.hydrateDocument(data, idMap)
  }

  public dispose() {
    this._interactions?.dispose()
    this._interactions = null

    this._projection.dispose()

    this.editor.renderer?.dispose()
    this._started = false
  }

  private _assertStarted() {
    if (!this._started) {
      throw new Error('[EditorRuntime] startup must be called first')
    }
  }
}
