import { readNodeName, walkTree } from '@latte-js/espresso'

import { System, SystemBase, Systems } from './systems'

import type { IDType, NodeType } from '@latte-js/bean'

interface IQuerySystemOptions {
  readonly rootIndex?: number
  readonly includeRoot?: boolean
}

@System
export class QuerySystem extends SystemBase {
  public static readonly name = Systems.Query

  private _queryIds(
    predicate: (index: number) => boolean,
    options: IQuerySystemOptions = {}
  ): IDType[] {
    const rootIndex = options.rootIndex ?? 0
    const includeRoot = options.includeRoot ?? false
    const results: IDType[] = []

    for (const idx of walkTree(this._sceneGraph, rootIndex)) {
      if (!includeRoot && idx === rootIndex) {
        continue
      }
      if (predicate(idx)) {
        const ID = this._sceneGraph.getUUID(idx)
        if (ID) {
          results.push(ID)
        }
      }
    }

    return results
  }

  public getElementsByType(
    type: NodeType,
    options?: IQuerySystemOptions
  ): IDType[] {
    return this._queryIds(idx => {
      const nodeType = this._sceneGraph.type[idx]
      return nodeType === type
    }, options)
  }

  public getElementsByName(
    name: string,
    options?: IQuerySystemOptions
  ): IDType[] {
    return this._queryIds(idx => {
      const n = readNodeName(this._sceneGraph, idx)
      return n === name
    }, options)
  }
}
