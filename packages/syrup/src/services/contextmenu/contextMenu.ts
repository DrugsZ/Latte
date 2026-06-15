import { type IPoint } from '@latte-js/kit'
import { Separator, type IAction } from '../../core/actions'
import { MenuId } from '../menu/menuRegistry'
import type { MenuService } from '../menu/menuService'
import { type IContextMenuService } from './contextMenuService'
import type { HitResult } from '@latte-js/bean'

export class ContextMenu {
  constructor(
    private readonly _contextMenuService: IContextMenuService,
    private readonly _menuService: MenuService
  ) {}

  private _getMenuActions(_hitResult?: HitResult) {
    // We could use hitResult here to pick a different MenuId
    const menu = this._menuService.createMenu(MenuId.EditorContext)
    const groups = menu.getActions()
    const result: IAction[] = []
    for (const group of groups) {
      const [, items] = group
      result.push(...items)
      result.push(new Separator())
    }
    if (result.length) {
      result.pop() // remove last separator
    }
    return result
  }

  public showContextMenu(anchor: IPoint, hitResult?: HitResult) {
    const actions = this._getMenuActions(hitResult)
    if (actions.length === 0) {
      return
    }
    this._contextMenuService.showContextMenu({
      getAnchor: () => anchor,
      getActions: () => actions as any,
    })
  }
}
