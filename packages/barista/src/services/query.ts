import {
  Channels,
  type IDType,
  type IQueryService,
  type NodeType,
} from '@latte-js/bean'

import { service, ServiceBase, type IContext } from './serviceBase'

import type { QuerySystem } from '../systems/query'
import {
  MutationPolicyKind,
  type MutationPolicyMap,
} from '../transactions/mutationPolicy'

const queryMutationPolicies: MutationPolicyMap = {
  getElementByTagName: { kind: MutationPolicyKind.Readonly },
  getElementByName: { kind: MutationPolicyKind.Readonly },
}

@service({ mutations: queryMutationPolicies })
export class QueryService
  extends ServiceBase<QuerySystem>
  implements IQueryService
{
  public static readonly name = Channels.Query

  constructor(ctx: IContext) {
    super(ctx)
  }

  public async getElementByTagName(
    tag: NodeType,
    parentID?: IDType
  ): Promise<IDType[]> {
    const parentNumber = parentID
      ? this.sceneGraph.getIndex(parentID)
      : undefined
    return this.system.getElementByTagName(tag, parentNumber)
  }

  public async getElementByName(
    name: string,
    parentID?: IDType
  ): Promise<IDType[]> {
    const parentNumber = parentID
      ? this.sceneGraph.getIndex(parentID)
      : undefined
    return this.system.getElementByName(name, parentNumber)
  }
}
