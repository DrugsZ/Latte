import { Part } from 'workbench/layout/part'

export class PanelPart extends Part {
  override createContentArea(
    parent: HTMLElement,
    options?: object | undefined
  ): HTMLElement | undefined {
    const panel = document.createElement('div')
    parent.appendChild(panel)
    return panel
  }
}
