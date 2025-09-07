import { MenuRegistry } from 'Latte/core/services/menu/menuRegistry'
import type {
  MenuId,
  IMenu,
  IMenuChangeEvent,
  MenuItemGroup,
} from 'Latte/core/services/menu/menuRegistry'
import { Disposable } from 'Latte/core/services/lifecycle/lifecycleService'
import type { Event } from 'Latte/utils/event'
import { Emitter } from 'Latte/utils/event'
import MenuItemAction from 'Latte/core/services/menu/menuAction'

interface IMenuService {
  createMenu(menuId: MenuId): IMenu
}

export class MenuImp extends Disposable implements IMenu {
  private _onDidChange: Emitter<IMenuChangeEvent> =
    new Emitter<IMenuChangeEvent>()

  private _menuGroups: MenuItemGroup[] = []

  public refresh() {
    this._menuGroups.length = 0
    const menuItems = MenuRegistry.getMenuItems(this._menuId)
    menuItems.sort((a, b) => {
      if (a.group && b.group) {
        return a.group.localeCompare(b.group)
      }
      if (a.group) {
        return -1
      }
      if (b.group) {
        return 1
      }
      return -1
    })

    let group: MenuItemGroup | undefined
    for (const item of menuItems) {
      // group by groupId
      const groupName = item.group || ''
      if (!group || group[0] !== groupName) {
        group = [groupName, []]
        this._menuGroups.push(group)
      }
      group![1].push(item)
    }
  }

  public onDidChange: Event<IMenuChangeEvent> = this._onDidChange.event

  constructor(private _menuId: MenuId) {
    super()
  }

  getActions(): [string, Array<MenuItemAction>][] {
    this.refresh()
    const result: [string, Array<MenuItemAction>][] = []
    for (const [groupName, items] of this._menuGroups) {
      const actions = items.map(item => new MenuItemAction(item))
      result.push([groupName, actions])
    }
    return result
  }
}

export class MenuService extends Disposable implements IMenuService {
  createMenu(menuId: MenuId): IMenu {
    return new MenuImp(menuId)
  }
}
