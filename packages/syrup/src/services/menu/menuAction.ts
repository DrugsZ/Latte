import type { IAction } from '../../core/actions'
import type { ICommandMenuItem } from './menuRegistry'
import type { CommandService } from '../command/commandService'

export default class MenuItemAction implements IAction {
  readonly id: string
  readonly label: string
  readonly tooltip: string
  readonly enabled: boolean = true
  readonly _commandService: CommandService

  constructor(public readonly item: ICommandMenuItem) {
    this.id = item.command.id
    this.label = item.command.title || item.command.id
    this.tooltip = item.command.tooltip || ''
  }

  run(event?: unknown): unknown {
    // Here we need to execute the command through the command service
    // Currently simplified
    return this._commandService.executeCommand(this.id)
  }
}
