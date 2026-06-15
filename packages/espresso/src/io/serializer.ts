import type { ILatteFile, ILatteNode } from '@latte-js/bean'

import { captureNodeSnapshot } from '../data/nodeSnapshot'

import type { SceneGraph } from '../data/sceneGraph'

export class Serializer {
  constructor(private _graph: SceneGraph) {}

  public serialize(): ILatteFile {
    const elements: ILatteNode[] = []

    const generations = this._graph.allocator.generations
    const indices = Array.from(this._graph.getUUIDMap().values()).sort(
      (a, b) => a - b
    )
    for (const index of indices) {
      if (!this._graph.allocator.isValid(index, generations[index])) {
        continue
      }
      const node = captureNodeSnapshot(this._graph, index)
      if (node.guid) {
        elements.push(node)
      }
    }

    return { elements }
  }

  public toJSON(compress = false): string {
    const data = this.serialize()
    return compress ? JSON.stringify(data) : JSON.stringify(data, null, 2)
  }
}
