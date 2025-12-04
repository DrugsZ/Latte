import {
  MenuRegistry,
  type MenuId,
} from 'Latte/core/services/menu/menuRegistry'
import {
  type IKeybindings,
  KeybindingsRegistry,
} from 'Latte/core/services/keybinding/keybindingsRegistry'
import { CommandsRegistry } from 'Latte/core/services/command/commandsRegistry'

export interface ICommandKeybindingsOptions extends IKeybindings {
  weight: number
  /**
   * the default keybinding arguments
   */
  args?: unknown
}

interface ICommandMenuOptions {
  id: MenuId
  title: string
  group?: string
  tooltip?: string
}
export interface ICommandOptions {
  id: string
  kbOpts?: ICommandKeybindingsOptions | ICommandKeybindingsOptions[]
  menu?: ICommandMenuOptions
}

export abstract class Command {
  public id: string
  private readonly _kbOpts:
    | ICommandKeybindingsOptions
    | ICommandKeybindingsOptions[]
    | undefined

  private readonly _menu?: ICommandMenuOptions
  constructor(opts: ICommandOptions) {
    this.id = opts.id
    this._kbOpts = opts.kbOpts
    this._menu = opts.menu
  }
  public register(): void {
    if (this._kbOpts) {
      const kbOptsArr = Array.isArray(this._kbOpts)
        ? this._kbOpts
        : [this._kbOpts]
      kbOptsArr.forEach(kbOpts => {
        const desc = {
          id: this.id,
          weight: kbOpts.weight,
          args: kbOpts.args,
          primary: kbOpts.primary,
          secondary: kbOpts.secondary,
        }

        KeybindingsRegistry.registerKeybindingRule(desc)
      })
    }
    if (this._menu) {
      const { id, ...item } = this._menu
      MenuRegistry.appendMenuItem(this._menu.id, {
        ...item,
        command: { ...item, id: this.id },
      })
    }
    CommandsRegistry.registerCommand(this.id, args => this.runCommand(args))
  }

  public abstract runCommand(args: unknown): void | Promise<void>
}
