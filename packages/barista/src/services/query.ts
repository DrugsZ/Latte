import {
  Channels,
  type IDType,
  type IQueryService,
  type NodeType,
} from '@latte-js/bean'
import { ServiceBase, type IContext, service } from './serviceBase'
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
    tag: keyof typeof NodeType,
    parentID?: IDType
  ): Promise<number[]> {
    const parentNumber = parentID
      ? this.sceneGraph.getIndex(parentID)
      : undefined
    return this.system.getElementByTagName(tag as any, parentNumber)
  }

  public async getElementByName(
    name: string,
    parentID?: IDType
  ): Promise<number[]> {
    const parentNumber = parentID
      ? this.sceneGraph.getIndex(parentID)
      : undefined
    return this.system.getElementByName(name, parentNumber)
  }
}
