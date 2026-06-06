export type MutationScopeKind =
  | 'history'
  | 'writeNoHistory'
  | 'manual'
  | 'pipeline'

export interface IMutationScope {
  readonly kind: MutationScopeKind
  readonly label?: string
  readonly source?: string
}
