import { walkTree, type SceneGraph } from '@latte-js/espresso'

import { system, SystemBase, Systems } from './systems'

import type { IDType, NodeType } from '@latte-js/bean'

@system
export class QuerySystem extends SystemBase {
  public static readonly name = Systems.Query

  constructor(sceneGraph: SceneGraph) {
    super(sceneGraph)
  }

  /**
   * @param predicate (index) => boolean
   */
  public query(
    predicate: (index: number) => boolean,
    parentId?: number
  ): IDType[] {
    const results: IDType[] = []

    for (const idx of walkTree(this._sceneGraph, parentId)) {
      if (predicate(idx)) {
        const ID = this._sceneGraph.getUUID(idx)
        if (ID) {
          results.push(ID)
        }
      }
    }

    return results
  }

  public getElementByTagName(tag: NodeType, parentId?: number): IDType[] {
    return this.query(idx => {
      const nodeType = this._sceneGraph.type[idx]
      return nodeType === tag
    }, parentId)
  }

  public getElementByName(name: string, parentId?: number): IDType[] {
    return this.query(idx => {
      const n = this._sceneGraph.nameMap.get(idx)
      return n === name
    }, parentId)
  }
}
