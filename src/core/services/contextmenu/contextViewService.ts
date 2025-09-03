import type { IAction } from 'Latte/core/common/actions'
import { ContextView } from 'Latte/ui/contextview/contextView'
import { ActionBar } from 'Latte/ui/actionBar/actionBar'
import { EventType } from 'Latte/core/dom/dom'

export interface IContextMenuShowOptions {
  getAnchor: () => IPoint
  getActions: () => IAction[]
  // getActionViewItem: () => IActionViewItem
  onHide: () => void
  onFocus: () => void
}

export class ContextViewService {
  private _view: HTMLElement
  private _contextView: ContextView

  constructor() {
    this._view = document.querySelector('.context-view')!
    if (!this._view) {
      this._view = document.createElement('ul')
      document.body.appendChild(this._view)
      this._view.className = 'context-view-container'
    }
    this._contextView = new ContextView(this._view)
  }

  public showContextMenu(options: IContextMenuShowOptions) {
    const anchor = options.getAnchor()
    this._view.style.display = 'block'
    this._view.style.left = `${anchor.x}px`
    this._view.style.top = `${anchor.y}px`
    this._contextView.show({
      render: container => {
        // Render the context menu items
        const actions = options.getActions()
        const actionBar = new ActionBar(container, actions)

        window.addEventListener(EventType.MOUSE_DOWN, event => {
          let target = event.target as HTMLElement
          while (target) {
            if (target === this._view) {
              return
            }
            target = target.parentElement as HTMLElement
          }
          this.hideContextView()
        })

        window.addEventListener(EventType.CLICK, e => {
          this.hideContextView()
        })
      },
      onFocus: () => {},
    })
  }

  public hideContextView(): void {
    this._contextView.hide()
  }
}
