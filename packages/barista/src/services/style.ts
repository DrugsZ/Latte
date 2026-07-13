import {
  Channels,
  type IDType,
  type IPaint,
  type IStyleService,
} from '@latte-js/bean'
import { NodeCursor, NULL_INDEX } from '@latte-js/espresso'

import { Service, ServiceBase, type IContext } from './serviceBase'

import {
  MutationPolicyKind,
  type MutationPolicyMap,
} from '../transactions/mutationPolicy'
import { TransactionLabel } from '../transactions/transactionLabels'

const styleMutationPolicies: MutationPolicyMap = {
  setFill: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.StyleLayer,
    ids: args => [args[0] as IDType],
  },
  clearFill: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.StyleLayer,
    ids: args => [args[0] as IDType],
  },
}

@Service({ mutations: styleMutationPolicies })
export class StyleService extends ServiceBase implements IStyleService {
  public static readonly name = Channels.Style

  constructor(ctx: IContext) {
    super(ctx)
  }

  public async setFill(id: IDType, paint: IPaint): Promise<void> {
    const cursor = this._getCursor(id)
    cursor.fills = [this._clonePaint(paint)]
  }

  public async clearFill(id: IDType): Promise<void> {
    const cursor = this._getCursor(id)
    cursor.fills = []
  }

  private _getCursor(id: IDType) {
    const index = this.sceneGraph.getIndex(id)
    if (index === NULL_INDEX) {
      throw new Error(`[StyleService] Node not found: ${id}`)
    }
    return new NodeCursor(this.sceneGraph, index)
  }

  private _clonePaint(paint: IPaint): IPaint {
    if (typeof structuredClone === 'function') {
      return structuredClone(paint)
    }
    return JSON.parse(JSON.stringify(paint)) as IPaint
  }
}
