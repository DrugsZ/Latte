import type { ITransformService, mat2d, Point } from '@latte-js/bean'
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
  }): Promise<void> {
    return Promise.resolve()
  }

  call<T = any>(
    ctx: string,
    method: string,
    ...args: any[]
  ): Promise<T> {
    return (this as any)[method](...args)
  }

  listen(
    ctx: string,
    event: string,
    ...args: any[]
  ): void {
    //
  }
}
