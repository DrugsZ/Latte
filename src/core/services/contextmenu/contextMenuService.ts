import type { IAction } from 'Latte/core/common/actions'
import { ContextViewService } from 'Latte/core/services/contextmenu/contextViewService'
import { Emitter } from 'Latte/utils/event'

export interface IContextMenuShowOptions {
  getAnchor: () => IPoint
  getActions: () => IAction[]
  // getActionViewItem: () => IActionViewItem
}

export class ContextMenuService {
  private readonly _contextViewService: ContextViewService
  private readonly _onDidHideMenu = new Emitter<void>()
  private readonly _onDidFocusMenu = new Emitter<void>()

  constructor() {
    this._contextViewService = new ContextViewService()
  }

  showContextMenu(options: IContextMenuShowOptions): void {
    this._contextViewService.showContextMenu({
      ...options,
      onHide: () => this._onDidHideMenu.fire(),
      onFocus: () => this._onDidFocusMenu.fire(),
    })
  }
}
