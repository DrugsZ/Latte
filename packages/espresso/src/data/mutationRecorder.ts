import type { IDType } from '@latte-js/bean'
import type { PropId } from './propKeys'

export interface INodeMutationRecord {
  readonly id: IDType
  readonly index: number
  readonly prop: PropId
  readonly oldValue: unknown
  readonly newValue: unknown
  readonly dirtyFlag: number
}

export interface IMutationRecorder {
  recordMutation(record: INodeMutationRecord): void
}
