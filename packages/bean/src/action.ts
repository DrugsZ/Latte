import type { MenuId } from './menu'

export interface IAction {
  id: string
  title: string

  run: (...args: any[]) => void | Promise<void>

  keybinding?: {
    primary: string
    when?: string
  }

  menu?: {
    id: MenuId
    group?: string
    when?: string
  }
}
