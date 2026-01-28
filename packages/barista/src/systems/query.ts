import type { NodeType } from '@latte-js/bean'
import { walkTree, type SceneGraph } from '@latte-js/espresso'
import { system, Systems, SystemBase } from './systems'

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
  ): number[] {
    const results: number[] = []

    for (const idx of walkTree(this._sceneGraph, parentId)) {
      if (predicate(idx)) {
        results.push(idx)
      }
    }

    return results
  }

  public getElementByTagName(tag: NodeType, parentId?: number): number[] {
    return this.query(idx => {
      const nodeType = this._sceneGraph.type[idx]
      return nodeType === tag
    }, parentId)
  }

  public getElementByName(name: string, parentId?: number): number[] {
    return this.query(idx => {
      const n = this._sceneGraph.nameMap.get(idx)
      return n === name
    }, parentId)
  }
}
