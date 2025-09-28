import type { Event } from 'Latte/utils/event'
import type { IDisposable } from 'Latte/core/services/lifecycle/lifecycleService'
import { LinkedList } from 'Latte/utils/linkedList'
import { Emitter } from 'Latte/utils/event'
import type { ICommandAction, Icon } from 'Latte/core/common/actions'
import type MenuItemAction from 'Latte/core/services/menu/menuAction'

export interface IMenuChangeEvent {
  readonly menu: IMenu
  readonly isStructuralChange: boolean
  readonly isToggleChange: boolean
  readonly isEnablementChange: boolean
}

export type MenuItemGroup = [string, Array<ICommandMenuItem>]

export interface IMenu extends IDisposable {
  readonly onDidChange: Event<IMenuChangeEvent>
  getActions(): [string, Array<MenuItemAction>][]
}

export interface ICommandMenuItem {
  command: ICommandAction
  alt?: ICommandAction
  group?: string
  order?: number
}

export interface ICommandSubmenuItem {
  title: string
  submenu: MenuId
  icon?: Icon
  group?: 'navigation' | string
  order?: number
  isSelection?: boolean
}

export class MenuId {
  private static readonly _instances = new Map<string, MenuId>()

  static readonly EditorContext = new MenuId('EditorContext')

  readonly id: string

  constructor(identifier: string) {
    if (MenuId._instances.has(identifier)) {
      throw new TypeError(
        `MenuId with identifier '${identifier}' already exists. Use MenuId.for(ident) or a unique identifier`
      )
    }
    MenuId._instances.set(identifier, this)
    this.id = identifier
  }
}

export interface IMenuRegistryChangeEvent {
  has(id: MenuId): boolean
}

export interface IMenuRegistry {
  readonly onDidChangeMenu: Event<IMenuRegistryChangeEvent>
  appendMenuItems(
    items: Iterable<{
      id: MenuId
      item: ICommandMenuItem | ICommandSubmenuItem
    }>
  ): void
  appendMenuItem(
    menu: MenuId,
    item: ICommandMenuItem | ICommandSubmenuItem
  ): void
  getMenuItems(loc: MenuId): Array<ICommandMenuItem | ICommandSubmenuItem>
}

class MenuRegistryChangeEvent {
  private static _all = new Map<MenuId, MenuRegistryChangeEvent>()

  static for(id: MenuId): MenuRegistryChangeEvent {
    let value = this._all.get(id)
    if (!value) {
      value = new MenuRegistryChangeEvent(id)
      this._all.set(id, value)
    }
    return value
  }

  static merge(events: IMenuRegistryChangeEvent[]): IMenuRegistryChangeEvent {
    const ids = new Set<MenuId>()
    for (const item of events) {
      if (item instanceof MenuRegistryChangeEvent) {
        ids.add(item.id)
      }
    }
    return ids
  }

  readonly has: (id: MenuId) => boolean

  private constructor(readonly id: MenuId) {
    this.has = candidate => candidate === id
  }
}

export const MenuRegistry = new (class implements IMenuRegistry {
  private readonly _onDidChangeMenu = new Emitter<IMenuRegistryChangeEvent>()
  readonly onDidChangeMenu = this._onDidChangeMenu.event

  private readonly _menuItems = new Map<MenuId, LinkedList<ICommandMenuItem>>()

  appendMenuItem(id: MenuId, item: ICommandMenuItem) {
    let list = this._menuItems.get(id)
    if (!list) {
      list = new LinkedList()
      this._menuItems.set(id, list)
    }
    const rm = list.push(item)
    this._onDidChangeMenu.fire(MenuRegistryChangeEvent.for(id))
    return rm
  }

  appendMenuItems(items: Iterable<{ id: MenuId; item: ICommandMenuItem }>) {
    const result: (() => void)[] = []
    for (const { id, item } of items) {
      result.push(this.appendMenuItem(id, item))
    }
    return result
  }

  getMenuItems(id: MenuId): Array<ICommandMenuItem> {
    let result: Array<ICommandMenuItem>
    if (this._menuItems.has(id)) {
      result = [...this._menuItems.get(id)!]
    } else {
      result = []
    }
    return result
  }
})()

export function registerEditorContextMenus(): void {
  const copyMenuItem: ICommandMenuItem = {
    command: {
      id: 'editor.action.copy',
      title: '复制',
      tooltip: '复制选中的元素',
    },
    group: 'clipboard',
    order: 1,
  }

  const pasteMenuItem: ICommandMenuItem = {
    command: {
      id: 'editor.action.paste',
      title: '粘贴',
      tooltip: '粘贴元素',
    },
    group: 'clipboard',
    order: 2,
  }

  const selectAllMenuItem: ICommandMenuItem = {
    command: {
      id: 'editor.action.selectAll',
      title: '全选',
      tooltip: '选择所有元素',
    },
    group: 'selection',
    order: 1,
  }

  const propertiesMenuItem: ICommandMenuItem = {
    command: {
      id: 'editor.action.properties',
      title: '属性',
      tooltip: '查看元素属性',
    },
    group: 'properties',
    order: 1,
  }
  MenuRegistry.appendMenuItems([
    { id: MenuId.EditorContext, item: copyMenuItem },
    { id: MenuId.EditorContext, item: pasteMenuItem },
    { id: MenuId.EditorContext, item: selectAllMenuItem },
    { id: MenuId.EditorContext, item: propertiesMenuItem },
  ])
}

export function initializeContextMenus(): void {
  registerEditorContextMenus()

  console.log('Context menus initialized')
}

initializeContextMenus()

// MenuRegistry.appendMenuItems(items)
