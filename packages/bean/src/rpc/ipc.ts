export type JsonRpcId = string | number | null

export const LATTE_RPC_PROTOCOL_VERSION = 1

export const LATTE_RPC_CAPABILITIES = [
  'typed-services',
  'mutation-policy',
  'session-scoped-mutations',
] as const

export type LatteRpcCapability = (typeof LATTE_RPC_CAPABILITIES)[number]

export enum JsonRpcErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ProtocolVersionMismatch = -32001,
  NotificationError = -32002,
}

export enum JsonRpcMessageType {
  Request = 'request',
  Notification = 'notification',
  ResponseSuccess = 'responseSuccess',
  ResponseError = 'ResponseError',
  Listen = 'listen',
  Unlisten = 'unlisten',
}

export interface JsonRpcBaseMessage {
  jsonrpc: '2.0'
  type: JsonRpcMessageType
  id: JsonRpcId
  protocolVersion?: number
  capabilities?: readonly LatteRpcCapability[]
  sessionId?: string
}

export interface JsonRpcRequest<T = any> extends JsonRpcBaseMessage {
  type: JsonRpcMessageType.Request
  method: string
  params?: T
}

export interface JsonRpcNotification<T = any> extends JsonRpcBaseMessage {
  type: JsonRpcMessageType.Notification
  method: string
  params?: T
}

export interface JsonRpcListenMessage<T = any> extends JsonRpcBaseMessage {
  type: JsonRpcMessageType.Listen
  method: string
  params?: T
}

export interface JsonRpcUnlistenMessage extends JsonRpcBaseMessage {
  type: JsonRpcMessageType.Unlisten
}

export interface IDisposable {
  dispose(): void
}

export interface JsonRpcSuccessResponse<T = any> extends JsonRpcBaseMessage {
  type: JsonRpcMessageType.ResponseSuccess
  result: T
}

export interface JsonRpcError<T = any> {
  code: number
  message: string
  data?: T
}

export interface JsonRpcErrorResponse<T = any> extends JsonRpcBaseMessage {
  type: JsonRpcMessageType.ResponseError
  error: JsonRpcError<T>
}

export type JsonRpcResponse<T = any> =
  | JsonRpcSuccessResponse<T>
  | JsonRpcErrorResponse<T>

export type JsonRpcMessage<T = any> =
  | JsonRpcRequest<T>
  | JsonRpcNotification<T>
  | JsonRpcListenMessage<T>
  | JsonRpcUnlistenMessage
  | JsonRpcResponse<T>
