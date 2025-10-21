import type { IAction } from 'Latte/core/common/actions'
import { EventType } from 'Latte/core/dom/dom'
import { StandardKeyboardEvent } from 'Latte/core/dom/keyboardEvent'
import type { IActionViewItem } from 'Latte/ui/actionBar/actionViewItem'
import { ActionViewItem } from 'Latte/ui/actionBar/actionViewItem'
import 'Latte/ui/actionBar/actionBar.css'
import { Separator } from 'Latte/core/common/actions'
import { KeyCode } from 'Latte/utils/keyCodes'

export interface IActionViewItemProvider {
  (action: IAction): IActionViewItem | undefined
}

export class ActionBar {
  public viewItems: IActionViewItem[] = []
  private _domNode: HTMLElement
  private _focusItem: number | undefined

  private _actionList: HTMLElement = document.createElement('ul')

  constructor(container: HTMLElement, actions: IAction[]) {
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
    if (this._focusItem === index) {
      return
    }
    const lastFocus = this._focusItem
      ? this.viewItems[this._focusItem!]
      : undefined
    this._focusItem = index
    if (lastFocus?.action.id === Separator.ID) {
      this._focusItem = undefined
      return
    }
    lastFocus?.blur()
    if (typeof this._focusItem === 'number') {
      this.viewItems[this._focusItem].focus()
    }
  }

  private _doTrigger() {
    const currentFocusItem = this.viewItems[this._focusItem!]
    currentFocusItem?.run()
  }

  public push(actions: IAction[]): void {
    actions.forEach(action => {
      const activeViewContainer = document.createElement('li')
      activeViewContainer.className = 'action-view-item'
      this._actionList.appendChild(activeViewContainer)

      const actionViewItem = new ActionViewItem(action)
      actionViewItem.render(activeViewContainer)
      this.viewItems.push(actionViewItem)
    })
    this._domNode.focus()
  }
}
