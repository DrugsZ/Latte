export const IContextService = 'IContextService'
export interface IContextService {
  /**
   * 获取当前活跃的上下文 ID
   * (对于 Editor 来说，这就是 activeDocumentId)
   */
  getContextId(): string | null | undefined
}

export const IRpcService = 'IRpcService'
export interface IRpcService {
  send(message: {
    documentId?: string | null
    channel: string
    method: string
    args: any[]
  }): Promise<any> | void
}
