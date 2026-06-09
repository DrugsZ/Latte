import { HitTester, type Renderer } from '@latte-js/art'
import { NULL_INDEX, type SceneGraph } from '@latte-js/espresso'

import type { EditorHost, IInputHitTestProvider } from '@latte-js/syrup'

export class RendererInputHitTestProvider implements IInputHitTestProvider {
  private _graph: SceneGraph
  private readonly _hitTester: HitTester

  constructor(
    private readonly _host: EditorHost<SceneGraph>,
    private readonly _renderer: Renderer
  ) {
    this._graph = this._host.graph
    this._hitTester = new HitTester(this._graph, this._renderer.camera)
  }

  public hitTest(clientX: number, clientY: number) {
    this._syncGraph()

    const client = this._renderer.camera.toWorld(clientX, clientY)
    const activeRootId = this._renderer.activeRootId
    if (!activeRootId) {
      return { hitResult: undefined, client }
    }

    const x = client.x
    const y = client.y
    const rTreeHits = this._renderer.rTree.search({
      minX: x,
      minY: y,
      maxX: x,
      maxY: y,
    })

    const candidates = new Set<number>()
    for (const item of rTreeHits) {
      let curr = (item as any).id
      while (curr !== NULL_INDEX) {
        if (candidates.has(curr)) {
          break
        }
        candidates.add(curr)
        curr = this._graph.parent[curr]
      }
    }

    const nodeIndex = this._hitTester.hitTest(x, y, activeRootId, candidates)
    if (nodeIndex === NULL_INDEX) {
      return { hitResult: undefined, client }
    }

    return {
      hitResult: {
        nodeIndex,
        nodeId: this._graph.getUUID(nodeIndex) || undefined,
      },
      client,
    }
  }

  private _syncGraph() {
    if (this._graph === this._host.graph) {
      return
    }

    this._graph = this._host.graph
    this._hitTester.setGraph(this._graph)
  }
}
