import {
  Channels,
  type IDType,
  type IStylePatch,
  type IStyleService,
} from '@latte-js/bean'
import { NodeCursor, NULL_INDEX } from '@latte-js/espresso'

import { MutationPolicyKind } from '../transactions/mutationPolicy'
import { Service, ServiceBase } from './serviceBase'
import { validateStylePatch } from '../validation/stylePatch'

@Service({
  mutations: {
    update: {
      kind: MutationPolicyKind.Atomic,
      label: 'Edit Layer Style',
      ids: args => (Array.isArray(args[0]) ? (args[0] as IDType[]) : []),
    },
  },
})
export class StyleService extends ServiceBase implements IStyleService {
  public static readonly name = Channels.Style

  public async update(ids: IDType[], patch: IStylePatch): Promise<void> {
    validateStylePatch(patch)
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
      throw new Error('[StyleService] ids must be an array of node ids')
    }

    // Resolve every target before writing so a missing target cannot leave a
    // partially applied multi-selection patch.
    const cursors = [...new Set(ids)].map(id => {
      const index = this.sceneGraph.getIndex(id)
      if (index === NULL_INDEX) {
        throw new Error(`[StyleService] Node not found: ${id}`)
      }
      return new NodeCursor(this.sceneGraph, index)
    })

    for (const cursor of cursors) {
      if (patch.name !== undefined && patch.name !== cursor.name) {
        cursor.name = patch.name
      }
      if (patch.fills !== undefined) {
        cursor.fills = structuredClone(patch.fills)
      }
      if (patch.opacity !== undefined && patch.opacity !== cursor.opacity) {
        cursor.opacity = patch.opacity
      }
      if (patch.visible !== undefined && patch.visible !== cursor.visible) {
        cursor.visible = patch.visible
      }
      if (patch.locked !== undefined && patch.locked !== cursor.locked) {
        cursor.locked = patch.locked
      }
    }
  }
}
