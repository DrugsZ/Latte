export type JsonRpcId = string | number | null

export enum JsonRpcMessageType {
  Request = 'request',
  Notification = 'notification',
  ResponseSuccess = 'responseSuccess',
  ResponseError = 'ResponseError',
}

export interface JsonRpcBaseMessage {
  jsonrpc: '2.0'
  type: JsonRpcMessageType
  id: JsonRpcId
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
  | JsonRpcResponse<T>
