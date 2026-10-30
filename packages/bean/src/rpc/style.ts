import type { IDType, IPaint } from '../schema'

export interface IStylePatch {
  readonly name?: string
  /** P0 supports solid paints and clearing fills with an empty array. */
  readonly fills?: IPaint[]
  /** Layer opacity in the inclusive range 0..1. */
  readonly opacity?: number
  readonly visible?: boolean
  readonly locked?: boolean
}

export interface IStyleService {
  /** Applies the same patch to every target as one undoable operation. */
  update(ids: IDType[], patch: IStylePatch): Promise<void>
}
