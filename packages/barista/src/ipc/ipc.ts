import {
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcNotification,
  type JsonRpcSuccessResponse,
  type JsonRpcErrorResponse,
  type JsonRpcMessage,
  type JsonRpcListenMessage,
  type JsonRpcUnlistenMessage,
  JsonRpcMessageType,
  type IServiceMap,
} from '@latte-js/bean'

export interface IChannel {
  call<T>(command: string, ...args: any[]): Promise<T> | void // if end with $, is mean fast, does not need return value to client
  listen(event: string, listener: (msg: JsonRpcMessage) => void): IDisposable
}

export interface IServerChannel {
  call<T>(ctx: string, command: string, ...args: any[]): Promise<T>
  listen(ctx: string, event: string, ...args: any[]): any
}

export interface IChannelClient {
  getChannel<T extends keyof IServiceMap>(channelName: T): IChannel
  getChannel(channelName: string): IChannel
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
  params?: any,
  sessionId?: string
): JsonRpcRequest => ({
  jsonrpc: '2.0',
  type: JsonRpcMessageType.Request,
  method,
  params,
  id,
  sessionId,
})

/**
 * Creates a standard JSON-RPC 2.0 Notification object.
 * @param method The name of the method to be invoked.
 * @param id A unique identifier established by the client.
 * @param params The parameter values to be used during the invocation of the method.
 */
export const createJsonRpcNotification = (
  method: string,
  id: JsonRpcId,
  params?: any,
  sessionId?: string
): JsonRpcNotification => ({
  jsonrpc: '2.0',
  type: JsonRpcMessageType.Notification,
  method,
  params,
  id,
  sessionId,
})

/**
 * Creates a standard JSON-RPC 2.0 Listen object.
 * @param method The name of the event to listen to.
 * @param id A unique identifier for this listener.
 * @param params Optional parameters for the listener.
 */
export const createJsonRpcListenMessage = (
  method: string,
  id: JsonRpcId,
  params?: any,
  sessionId?: string
): JsonRpcListenMessage => ({
  jsonrpc: '2.0',
  type: JsonRpcMessageType.Listen,
  method,
  params,
  id,
  sessionId,
})

/**
 * Creates a standard JSON-RPC 2.0 Unlisten object.
 * @param id The identifier of the listener to be removed.
 */
export const createJsonRpcUnlistenMessage = (
  id: JsonRpcId,
  sessionId?: string
): JsonRpcUnlistenMessage => ({
  jsonrpc: '2.0',
  type: JsonRpcMessageType.Unlisten,
  id,
  sessionId,
})

/**
 * Creates a standard JSON-RPC 2.0 Success Response object.
 * @param id The identifier established by the client in the request.
 * @param result The result of the method invocation.
 */
export const createJsonRpcSuccessResponse = (
  id: JsonRpcId,
  result: any,
  sessionId?: string
): JsonRpcSuccessResponse => ({
  jsonrpc: '2.0',
  type: JsonRpcMessageType.ResponseSuccess,
  result,
  id,
  sessionId,
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
  data?: any,
  sessionId?: string
): JsonRpcErrorResponse => ({
  jsonrpc: '2.0',
  type: JsonRpcMessageType.ResponseError,
  error: {
    code,
    message,
    data,
  },
  id,
  sessionId,
})
