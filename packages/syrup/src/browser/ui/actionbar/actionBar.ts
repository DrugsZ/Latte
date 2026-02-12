import { ActionViewItem } from './actionViewItem'
import './actionBar.css'
import { Separator, type IAction } from '../../../core/actions'
import { EventType, KeyCode } from '@latte-js/kit'
import { StandardKeyboardEvent } from '../../../dom/keyboardEvent'
import type { IActionViewItem } from './actionViewItem'
import type { CommandService } from '../../../services/command/commandService'

export interface IActionViewItemProvider {
  (action: IAction): IActionViewItem | undefined
}

export class ActionBar {
  public viewItems: IActionViewItem[] = []
  private _domNode: HTMLElement
  private _focusItem: number | undefined

  private _actionList: HTMLElement = document.createElement('ul')

  constructor(
    container: HTMLElement,
    actions: IAction[],
    private readonly _commandService: CommandService
  ) {
    this._domNode = document.createElement('div')
    this._domNode.className = 'action-bar'
    this._actionList = document.createElement('ul')
    this._actionList.className = 'action-list'
    this._domNode.appendChild(this._actionList)
    container.appendChild(this._domNode)

    this.push(actions)
    this._onMouseOver()

    document.body.addEventListener(EventType.KEY_DOWN, e => {
      if (!this.viewItems.length) {
        return
      }
      const event = new StandardKeyboardEvent(e)
      if (event.equals(KeyCode.DownArrow)) {
        this._focusNext()
      } else if (event.equals(KeyCode.UpArrow)) {
        this._focusPrevious()
      } else if (event.equals(KeyCode.Home)) {
        this._focusFirst()
      } else if (event.equals(KeyCode.End)) {
        this._focusLast()
      } else if (event.equals(KeyCode.Enter)) {
        this._doTrigger()
      }
    })
  }

  private _focusLast() {
    this._updateFocus(this.viewItems.length - 1)
  }

  private _focusFirst() {
    this._updateFocus(0)
  }

  private _focusNext() {
    let newFocusItem = this._focusItem
    if (typeof newFocusItem === 'undefined') {
      newFocusItem = -1
    }
    let nextIndex = newFocusItem + 1
    if (nextIndex >= this.viewItems.length) {
      nextIndex = 0
    }
    while (this.viewItems[nextIndex]?.action.id === Separator.ID) {
      nextIndex++
    }
    this._updateFocus(nextIndex)
  }

  private _focusPrevious() {
    let newFocusItem = this._focusItem
    if (typeof newFocusItem === 'undefined') {
      newFocusItem = this.viewItems.length
    }
    let previousIndex = newFocusItem - 1
    if (previousIndex < 0) {
      previousIndex = this.viewItems.length - 1
    }
    while (this.viewItems[previousIndex]?.action.id === Separator.ID) {
      previousIndex--
    }
    this._updateFocus(previousIndex)
  }

  private _onMouseOver() {
    this._actionList.addEventListener(EventType.MOUSE_MOVE, event => {
      const target = event.target as HTMLElement
      const index = Array.from(this._actionList.children).findIndex(
        item => item === target
      )
      if (index !== -1) {
        this._updateFocus(index)
      }
    })
  }

  private _updateFocus(index: number) {
    if (this._focusItem !== undefined) {
      this.viewItems[this._focusItem].blur()
    }
    this._focusItem = index
    this.viewItems[this._focusItem]?.focus()
  }

  private _doTrigger() {
    if (this._focusItem !== undefined) {
      this.viewItems[this._focusItem].run()
    }
  }

  public push(actions: IAction[]) {
    actions.forEach(action => {
      const viewItem = new ActionViewItem(action, this._commandService)
      viewItem.render(this._actionList)
      this.viewItems.push(viewItem)
    })
  }
}
