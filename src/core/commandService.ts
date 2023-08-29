import type {
  ICommandService,
  ICommandEvent,
} from 'Latte/core/commandsRegistry'
import { CommandsRegistry } from 'Latte/core/commandsRegistry'
import { Emitter, Event } from 'Latte/common/event'

export class CommandService implements ICommandService {
  private readonly _onWillExecuteCommand: Emitter<ICommandEvent> =
    new Emitter<ICommandEvent>()
  public readonly onWillExecuteCommand: Event<ICommandEvent> =
    this._onWillExecuteCommand.event

  private readonly _onDidExecuteCommand: Emitter<ICommandEvent> =
    new Emitter<ICommandEvent>()
  public readonly onDidExecuteCommand: Event<ICommandEvent> =
    this._onDidExecuteCommand.event

  executeCommand<T = any>(
    commandId: string,
    ...args: any[]
  ): Promise<T | undefined> {
    return this._tryExecuteCommand(commandId, args)
  }

  private _tryExecuteCommand(id: string, args: any[]): Promise<any> {
    const command = CommandsRegistry.getCommand(id)
    if (!command) {
      return Promise.reject(new Error(`command '${id}' not found`))
    }
    try {
      this._onWillExecuteCommand.fire({ commandId: id, args })
      const result = command.handler.call(null, ...args)
      this._onDidExecuteCommand.fire({ commandId: id, args })
      return Promise.resolve(result)
    } catch (err) {
      return Promise.reject(err)
    }
  }
}
