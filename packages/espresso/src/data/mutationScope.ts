export enum MutationScopeKind {
  History = 'history',
  WriteNoHistory = 'writeNoHistory',
  Manual = 'manual',
  Pipeline = 'pipeline',
}

export interface IMutationScope {
  readonly kind: MutationScopeKind
  readonly label?: string
  readonly source?: string
}
