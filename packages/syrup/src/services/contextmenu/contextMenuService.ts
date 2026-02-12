import { Emitter, type IPoint } from '@latte-js/kit'
import { IContextViewService } from '../contextview/contextViewService'
import { createDecorator } from '../instantiation/instantiation'
import type { Action } from '../../core/actions'

export const IContextMenuService =
  createDecorator<IContextMenuService>('contextMenuService')

export interface IContextMenuShowOptions {
  getAnchor: () => IPoint
  getActions: () => Action[]
  // getActionViewItem: () => IActionViewItem
}

export interface IContextMenuService {
  showContextMenu(options: IContextMenuShowOptions): void
}

export class ContextMenuService implements IContextMenuService {
  private readonly _onDidHideMenu = new Emitter<void>()
  public readonly onDidHideMenu = this._onDidHideMenu.event

  private readonly _onDidFocusMenu = new Emitter<void>()
  public readonly onDidFocusMenu = this._onDidFocusMenu.event

  constructor(
    @IContextViewService
    private readonly _contextViewService: IContextViewService
  ) {}

  showContextMenu(options: IContextMenuShowOptions): void {
    this._contextViewService.showContextMenu({
      ...options,
      onHide: () => this._onDidHideMenu.fire(),
      onFocus: () => this._onDidFocusMenu.fire(),
    })
  }
}
