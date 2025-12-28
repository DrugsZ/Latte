export {
  WebMessagePassingProtocol,
  WebWorkerMessagePassingProtocol,
} from './protocol/ipcWorker'
export { ChannelServer } from './channelServer'
export { ChannelClient } from './channelClient'
export type {
  IChannel,
  IServerChannel,
  IChannelClient,
  IChannelServer,
  IDisposable,
} from './ipc'

export { toService, fromService } from './proxyChannel'
