import type {
  ITransformService,
  mat2d,
  Point,
  JsonRpcResponse,
} from '@latte-js/bean'
import type { IServerChannel } from '../ipc'

export class TransformChannel implements ITransformService, IServerChannel {
  public static readonly channelName = 'transform'
  async startSession(ids: number[]): Promise<void> {
    return Promise.resolve()
  }

  async endSession(): Promise<void> {
    return Promise.resolve()
  }

  async abortSession(): Promise<void> {
    return Promise.resolve()
  }

  async updateSession$(payload: {
    matrix: mat2d
    origin: Point
  }): Promise<void> {
    return Promise.resolve()
  }

  async updateSession(payload: {
    matrix: mat2d
    origin: Point
  }): Promise<JsonRpcResponse> {
    return Promise.resolve({
      jsonrpc: '2.0',
      id: 1,
      result: null,
    })
  }

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
