export type JsonRpcId = string | number | null

export interface JsonRpcRequest<T = any> {
  jsonrpc: '2.0'
  method: string
  params?: T
  id: JsonRpcId
}

export interface JsonRpcNotification<T = any> {
  jsonrpc: '2.0'
  method: string
  params?: T
}

export interface JsonRpcSuccessResponse<T = any> {
  jsonrpc: '2.0'
  result: T
  id: JsonRpcId
}

export interface JsonRpcError<T = any> {
  code: number
  message: string
  data?: T
}

export interface JsonRpcErrorResponse<T = any> {
  jsonrpc: '2.0'
  error: JsonRpcError<T>
  id: JsonRpcId
}

export type JsonRpcResponse<T = any> =
  | JsonRpcSuccessResponse<T>
  | JsonRpcErrorResponse<T>

export type JsonRpcMessage<T = any> =
  | JsonRpcRequest<T>
  | JsonRpcNotification<T>
  | JsonRpcResponse<T>
