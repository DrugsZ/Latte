import type {
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
} from '@latte-js/bean'

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

export interface IDisposable {
  dispose(): void
}

/**
 * Creates a standard JSON-RPC 2.0 Request object.
 * @param method The name of the method to be invoked.
 * @param id A unique identifier established by the client.
 * @param params The parameter values to be used during the invocation of the method.
 */
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

/**
 * Creates a standard JSON-RPC 2.0 Notification object.
 * @param method The name of the method to be invoked.
 * @param params The parameter values to be used during the invocation of the method.
 */
export const createJsonRpcNotification = (
  method: string,
  params?: any
): JsonRpcNotification => ({
  jsonrpc: '2.0',
  method,
  params,
})

/**
 * Creates a standard JSON-RPC 2.0 Success Response object.
 * @param id The identifier established by the client in the request.
 * @param result The result of the method invocation.
 */
export const createJsonRpcSuccessResponse = (
  id: JsonRpcId,
  result: any
): JsonRpcSuccessResponse => ({
  jsonrpc: '2.0',
  result,
  id,
})

/**
 * Creates a standard JSON-RPC 2.0 Error Response object.
 * @param id The identifier established by the client in the request.
 * @param code A number that indicates the error type that occurred.
 * @param message A string providing a short description of the error.
 * @param data A primitive or structured value that contains additional information about the error.
 */
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
