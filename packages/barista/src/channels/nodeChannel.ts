import type { INodeService } from '@latte-js/bean'
import type { IServerChannel } from '../ipc'

export class NodeChannel implements INodeService, IServerChannel {
  public static readonly channelName = 'node'
  constructor() {}

  async create(type: string, x: number, y: number): Promise<string> {
    return Promise.resolve('1')
  }

  async updateFast$(id: string, x: number, y: number): Promise<void> {}

  call<Context = string>(
    ctx: Context,
    method: string,
    args: any[]
  ): Promise<any> {
    return (this as any)[method](...args)
  }

  listen<TContext = string>(
    ctx: TContext,
    event: string,
    args?: any[]
  ): Promise<void> {
    return Promise.resolve()
  }
}
