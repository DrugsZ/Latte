import { Part } from 'workbench/layout/part'
import Editor from 'Latte/core/editor'

export class EditorPart extends Part {
  override createContentArea(
    parent: HTMLElement,
    options?: object
  ): HTMLElement | undefined {
    const canvas = this._createCanvas(parent)
    const editor = new Editor(canvas)
    return canvas
  }

  private _createCanvas(parent: HTMLElement) {
    const { width, height } = parent.getBoundingClientRect()
    const canvas = document.createElement('canvas')
    canvas.setAttribute('width', String(width))
    canvas.setAttribute('height', String(height))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    parent.appendChild(canvas)
    return canvas
  }
}
