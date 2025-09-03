import type { IAction } from 'Latte/core/common/actions'
import { EventType } from 'Latte/core/dom/dom'
import type { CommandService } from 'Latte/core/services/command/commandService'
import { Separator } from 'Latte/core/common/actions'

export interface IActionViewItem {
  action: IAction
  setActionContext(context: unknown): void
  render(element: HTMLElement): void
  isEnabled(): boolean
  focus(fromRight?: boolean): void // TODO@isidorn what is this?
  blur(): void
  run: () => void
}

export class ActionViewItem implements IActionViewItem {
  action: IAction
  private _context: unknown
  private _element: HTMLElement | undefined

  constructor(action: IAction, private _commandService: CommandService) {
    this.action = action
  }

  setActionContext(context: unknown): void {
    this._context = context
  }

  render(container: HTMLElement): void {
    this._element = container
    this._element.classList.add('action-view-item')
    container.textContent = this.action.label
    if (this.action.id === Separator.ID) {
      this._element.classList.add('separator')
    }
    this._bindEvent()
  }

  private _bindEvent() {
    this._element?.addEventListener(EventType.CLICK, event => {
      if (this.isEnabled()) {
        this.run()
        event.stopPropagation()
        // this.action.run(this._context)
      }
    })

    this._element?.addEventListener(EventType.KEY_DOWN, event => {
      this.focus()
    })
    this._element?.addEventListener(EventType.KEY_UP, event => {
      this.blur()
    })

    this._element?.addEventListener(EventType.MOUSE_OUT, event => {
      this.blur()
    })
  }

  focus(): void {
    this._element?.focus()
    this._element?.classList.add('focused')
  }

  blur(): void {
    this._element?.classList.remove('focused')
  }

  isEnabled() {
    return this.action.enabled
  }

  public run() {
    console.log(this)
    return this._commandService.executeCommand(this.action.id)
  }
}
