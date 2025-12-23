export interface IChannel {
  call<T>(command: string, ...args: any[]): Promise<T>
  listen<T>(event: string, ...args: any[]): void
}

export interface IServerChannel<TContext = string> {
  call<T>(ctx: TContext, command: string, args?: any[]): Promise<T>
  listen<T>(ctx: TContext, event: string, args?: any[]): void
}

export type RemoteChannel<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => R extends Promise<any> ? R : Promise<R>
    : T[K]
}

export interface IChannelClient {
  getChannel<T extends object>(channelName: string): RemoteChannel<T>
}

export interface IChannelServer {
  registerChannel(channelName: string, channel: IServerChannel): void
}

export type JsonRpcId = string | number | null

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: any
  id: JsonRpcId
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: any
}

export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0'
  result: any
  id: JsonRpcId
}

export interface JsonRpcError {
  code: number
  message: string
  data?: any
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0'
  error: JsonRpcError
  id: JsonRpcId
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcResponse

export interface IDisposable {
  dispose(): void
}

export const createJsonRpcRequest = (
  method: string,
  id: JsonRpcId,
  params?: any
): JsonRpcRequest => ({
  jsonrpc: '2.0',
  method,
  params,
  id,
})

export const createJsonRpcNotification = (
  method: string,
  params?: any
): JsonRpcNotification => ({
  jsonrpc: '2.0',
  method,
  params,
})

export const createJsonRpcSuccessResponse = (
  id: JsonRpcId,
  result: any
): JsonRpcSuccessResponse => ({
  jsonrpc: '2.0',
  result,
  id,
})

export const createJsonRpcErrorResponse = (
  id: JsonRpcId,
  code: number,
  message: string,
  data?: any
): JsonRpcErrorResponse => ({
  jsonrpc: '2.0',
  error: {
    code,
    message,
    data,
  },
  id,
})
