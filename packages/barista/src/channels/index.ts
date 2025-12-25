import type { IServerChannel } from '../ipc'
import { NodeChannel } from './nodeChannel'
import { TransformChannel } from './transformChannel'

export const channels: IServerChannelConstructor<IServerChannel>[] = [
  NodeChannel,
  TransformChannel,
]

export interface IServerChannelConstructor<T extends IServerChannel> {
  readonly channelName: string
  new (): T
}
