export interface IDocument<T = any> {
  readonly id: string
  readonly uri: string
  readonly graph: T
  isDirty: boolean
}
