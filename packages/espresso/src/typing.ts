import type { PropId } from './data/propKeys'

export interface IGraphObserver {
  update<T = any>(id: string, key: PropId, oldValue: T, newValue: T): void
}
