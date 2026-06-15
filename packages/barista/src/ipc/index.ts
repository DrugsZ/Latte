export {
  WebMessagePassingProtocol,
  WebWorkerMessagePassingProtocol,
} from './protocol/ipcWorker'
export { ChannelServer } from './channelServer'
export { ChannelClient, ChannelClientError } from './channelClient'
export type {
  IChannel,
  IChannelCallContext,
  IServerChannel,
  IChannelClient,
  IChannelServer,
  IDisposable,
} from './ipc'

export { toService, fromService } from './proxyChannel'
