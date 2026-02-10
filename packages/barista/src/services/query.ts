import {
  Channels,
  type IDType,
  type IQueryService,
  type NodeType,
} from '@latte-js/bean'

import { service, ServiceBase, type IContext } from './serviceBase'

import type { QuerySystem } from '../systems/query'

@service
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
