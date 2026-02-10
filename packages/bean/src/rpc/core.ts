export const IContextService = 'IContextService'
export interface IContextService {
  getContextId(): Record<string, any> | null | undefined
}
