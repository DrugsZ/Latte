import type { Action } from '../../core/actions'
import { ContextView } from '../../browser/ui/contextview/contextView'
import { ActionBar } from '../../browser/ui/actionbar/actionBar'
import { EventType, type IPoint } from '@latte-js/kit'
import { createDecorator } from '../instantiation/instantiation'
import { ICommandService } from '../command/commandsRegistry'
import type { CommandService } from '../command/commandService'

export const IContextViewService =
  createDecorator<IContextViewService>('contextViewService')

export interface IContextMenuShowOptions {
  getAnchor: () => IPoint
  getActions: () => Action[]
  // getActionViewItem: () => IActionViewItem
  onHide?: () => void
  onFocus?: () => void
}

export interface IContextViewService {
  showContextMenu(options: IContextMenuShowOptions): void
  hideContextView(): void
}

export class ContextViewService implements IContextViewService {
  private _view: HTMLElement
  private _contextView: ContextView

  constructor(
    @ICommandService private readonly _commandService: CommandService
  ) {
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
    this._view.style.position = 'absolute'
    this._view.style.zIndex = '1000'

    this._contextView.show({
      render: container => {
        // Render the context menu items
        const actions = options.getActions()
        new ActionBar(container, actions, this._commandService)

        const mouseDownHandler = (event: MouseEvent) => {
          let target = event.target as HTMLElement
          while (target) {
            if (target === this._view) {
              return
            }
            target = target.parentElement as HTMLElement
          }
          this.hideContextView()
          window.removeEventListener(EventType.MOUSE_DOWN, mouseDownHandler)
        }

        window.addEventListener(EventType.MOUSE_DOWN, mouseDownHandler)

        const clickHandler = () => {
          this.hideContextView()
          window.removeEventListener(EventType.CLICK, clickHandler)
        }

        window.addEventListener(EventType.CLICK, clickHandler)
      },
      onFocus: () => {},
    })
  }

  public hideContextView(): void {
    this._contextView.hide()
    this._view.style.display = 'none'
  }
}
