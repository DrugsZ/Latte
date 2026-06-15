import {
  Channels,
  type IDType,
  type IQueryOptions,
  type IQueryService,
  type NodeType,
} from '@latte-js/bean'

import { Service, SystemBackedServiceBase, type IContext } from './serviceBase'

import type { QuerySystem } from '../systems/query'
import { Systems } from '../systems'
import {
  MutationPolicyKind,
  type MutationPolicyMap,
} from '../transactions/mutationPolicy'

const queryMutationPolicies: MutationPolicyMap = {
  getElementsByType: { kind: MutationPolicyKind.Readonly },
  getElementsByName: { kind: MutationPolicyKind.Readonly },
}

@Service({ system: Systems.Query, mutations: queryMutationPolicies })
export class QueryService
  extends SystemBackedServiceBase<QuerySystem>
  implements IQueryService
{
  public static readonly name = Channels.Query

  constructor(ctx: IContext) {
    super(ctx)
  }

  public async getElementsByType(
    type: NodeType,
    options?: IQueryOptions
  ): Promise<IDType[]> {
    return this.system.getElementsByType(type, this._resolveOptions(options))
  }

  public async getElementsByName(
    name: string,
    options?: IQueryOptions
  ): Promise<IDType[]> {
    return this.system.getElementsByName(name, this._resolveOptions(options))
  }

  private _resolveOptions(options?: IQueryOptions) {
    if (!options?.rootId) {
      return { includeRoot: options?.includeRoot }
    }

    const rootIndex = this.sceneGraph.getIndex(options.rootId)
    if (rootIndex < 0) {
      throw new Error(`[QueryService] Root node not found: ${options.rootId}`)
    }

    return {
      rootIndex,
      includeRoot: options.includeRoot,
    }
  }
}
