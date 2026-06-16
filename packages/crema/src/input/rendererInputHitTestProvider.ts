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

    const rect = this._renderer.canvas.getBoundingClientRect()
    const localX = clientX - rect.left
    const localY = clientY - rect.top
    const client = this._renderer.camera.toWorld(localX, localY)
    const activeRootId = this._renderer.activeRootId
    if (!activeRootId) {
      return { hitResult: undefined, client }
    }

    const indexedCandidates = this._renderer.queryHitTestCandidates(
      client.x,
      client.y,
      activeRootId
    )

    let candidates: Set<number> | undefined
    if (indexedCandidates.length > 0) {
      candidates = new Set<number>()
      for (const index of indexedCandidates) {
        let curr = index
        while (curr !== NULL_INDEX) {
          if (candidates.has(curr)) {
            break
          }
          candidates.add(curr)
          curr = this._graph.parent[curr]
        }
      }
    }

    const nodeIndex = this._hitTester.hitTest(
      localX,
      localY,
      activeRootId,
      candidates
    )
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
