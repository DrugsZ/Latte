import type { IAction } from 'Latte/core/common/actions'
import { ContextMenuService } from 'Latte/core/services/contextmenu/contextMenuService'
import { MenuId } from 'Latte/core/services/menu/menuRegistry'
import { MenuService } from 'Latte/core/services/menu/menuService'
import { Separator } from 'Latte/core/common/actions'

export class ContextMenu {
  private _contextMenuService: ContextMenuService = new ContextMenuService()
  private _menuService: MenuService = new MenuService()

  private _getMenuActions() {
    const menu = this._menuService.createMenu(MenuId.EditorContext)
    const group = menu.getActions()
    const result: IAction[] = []
    for (const [groupName, items] of group) {
      result.push(...items)
      result.push(new Separator())
    }
    if (result.length) {
      result.pop() // remove last separator
    }
    return result
  }

  public showContextMenu(anchor: IPoint) {
    const actions = this._getMenuActions()
    if (actions.length === 0) {
      return
    }
    this._contextMenuService.showContextMenu({
      getActions: () => actions,
      getAnchor: () => anchor || { x: 100, y: 100 },
    })
  }
}
