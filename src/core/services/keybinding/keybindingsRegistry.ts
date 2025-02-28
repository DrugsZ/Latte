import type { Keybinding } from 'Latte/common/keybindings'
import { decodeKeybinding } from 'Latte/common/keybindings'
import { LinkedList } from 'Latte/common/linkedList'
import { OS } from 'Latte/common/platform'

export interface IKeybindings {
  primary?: number
  secondary?: number[]
}

export interface IKeybindingRule extends IKeybindings {
  id: string
  weight: number
  args?: any
}

export interface IKeybindingItem {
  keybinding: Keybinding | null
  command: string | null
  commandArgs?: any
  weight: number
}

class KeybindingsRegistryImpl {
  private _coreKeybindings: LinkedList<IKeybindingItem> = new LinkedList()

  public registerKeybindingRule(rule: IKeybindingRule) {
    if (rule && rule.primary) {
      const kk = decodeKeybinding(rule.primary, OS)
      if (kk) {
        this._registerDefaultKeybinding(kk, rule.id, rule.args, rule.weight)
      }
    }

    if (rule && Array.isArray(rule.secondary)) {
      for (let i = 0, len = rule.secondary.length; i < len; i++) {
        const k = rule.secondary[i]
        const kk = decodeKeybinding(k, OS)
        if (kk) {
          this._registerDefaultKeybinding(kk, rule.id, rule.args, rule.weight)
        }
      }
    }
  }

  private _registerDefaultKeybinding(
    keybinding: Keybinding,
    commandId: string,
    commandArgs: any,
    weight: number
  ) {
    const remove = this._coreKeybindings.push({
      keybinding,
      command: commandId,
      commandArgs,
      weight,
    })

    return remove
  }

  public getDefaultKeybindings(): IKeybindingItem[] {
    return Array.from(this._coreKeybindings)
  }
}

export const KeybindingsRegistry = new KeybindingsRegistryImpl()
