import type { Event } from 'Latte/utils/event'
import { Emitter } from 'Latte/utils/event'
import { LinkedList } from 'Latte/utils/linkedList'

export interface ICommandHandler {
  (...args: any[]): void
}

export interface ICommand {
  id: string
  handler: ICommandHandler
}

export type ICommandsMap = Map<string, ICommand>

export interface ICommandEvent {
  commandId: string
  args: any[]
}

export interface ICommandService {
  onWillExecuteCommand: Event<ICommandEvent>
  onDidExecuteCommand: Event<ICommandEvent>
  executeCommand<T = any>(
    commandId: string,
    ...args: any[]
  ): Promise<T | undefined>
}

export interface ICommandRegistry {
  onDidRegisterCommand: Event<string>
  registerCommand(id: string, command: ICommandHandler): void
  getCommand(id: string): ICommand | undefined
  getCommands(): ICommandsMap
}

export type TypeConstraint = string | Function

export const CommandsRegistry: ICommandRegistry = new (class
  implements ICommandRegistry
{
  private readonly _commands = new Map<string, LinkedList<ICommand>>()

  private readonly _onDidRegisterCommand = new Emitter<string>()
  readonly onDidRegisterCommand: Event<string> =
    this._onDidRegisterCommand.event

  registerCommand(idOrCommand: string | ICommand, handler?: ICommandHandler) {
    if (!idOrCommand) {
      throw new Error(`invalid command`)
    }

    if (typeof idOrCommand === 'string') {
      if (!handler) {
        throw new Error(`invalid command`)
      }
      return this.registerCommand({ id: idOrCommand, handler })
    }

    // find a place to store the command
    const { id } = idOrCommand

    let commands = this._commands.get(id)
    if (!commands) {
      commands = new LinkedList<ICommand>()
      this._commands.set(id, commands)
    }

    const removeFn = commands.unshift(idOrCommand)

    const ret = () => {
      removeFn()
      const command = this._commands.get(id)
      if (command?.isEmpty()) {
        this._commands.delete(id)
      }
    }

    // tell the world about this command
    this._onDidRegisterCommand.fire(id)

    return ret
  }

  getCommand(id: string): ICommand | undefined {
    const list = this._commands.get(id)
    if (!list || list.isEmpty()) {
      return undefined
    }
    return list[Symbol.iterator]().next().value
  }

  getCommands(): ICommandsMap {
    const result = new Map<string, ICommand>()
    for (const key of this._commands.keys()) {
      const command = this.getCommand(key)
      if (command) {
        result.set(key, command)
      }
    }
    return result
  }
})()

CommandsRegistry.registerCommand('noop', () => {})
