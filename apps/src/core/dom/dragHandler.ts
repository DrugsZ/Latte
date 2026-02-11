import * as dom from 'Latte/core/dom/dom'
import type { ITextureLoadResult } from 'Latte/core/texture'
import { textureManager } from 'Latte/core/texture'
import { ACCEPT_IMAGE_TYPES } from 'Latte/assets/constant'
import { DropMouseEvent } from 'Latte/core/dom/mouseEvent'
import type { ViewController } from 'Latte/core/view/viewController'

export class DragHandler {
  constructor(
    private _renderDOM: HTMLElement,
    private readonly _client2Viewport: (point: IPoint) => IPoint,
    private readonly _viewContainer: ViewController
  ) {
    this._renderDOM.addEventListener(
      dom.EventType.DRAG_OVER,
      this._stopPropagationAndDefault.bind(this)
    )
    this._renderDOM.addEventListener(
      dom.EventType.DROP,
      this._handleDrag.bind(this)
    )
  }

  private _verifyFileType(file: File) {
    return ACCEPT_IMAGE_TYPES.includes(file.type)
  }

  private _stopPropagationAndDefault(event: DragEvent) {
    event.stopPropagation()
    event.preventDefault()
  }

  private async _handleUploadFile(file: File) {
    return textureManager.load(file)
  }

  private async _handleUploadFiles(files: FileList) {
    const allFiles: ITextureLoadResult[] = []
    // eslint-disable-next-line no-restricted-syntax
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (this._verifyFileType(file)) {
        // eslint-disable-next-line no-await-in-loop
        allFiles.push(await this._handleUploadFile(file))
      }
    }
    return allFiles.sort((a, b) => a.name.localeCompare(b.name))
  }

  private async _handleDrag(event: DragEvent) {
    this._stopPropagationAndDefault(event)
    const { dataTransfer } = event
    if (!dataTransfer) {
      return
    }
    const { files } = dataTransfer
    const allHash = await this._handleUploadFiles(files)
    const dropEvent = new DropMouseEvent(event)
    const dropPosition = this._client2Viewport({
      x: event.offsetX,
      y: event.offsetY,
    })
    this._viewContainer.emitDrop(allHash, dropPosition)
  }
}
