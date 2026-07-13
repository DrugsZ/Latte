import { HitTester, type Renderer } from '@latte-js/art'
import { NULL_INDEX, type SceneGraph } from '@latte-js/espresso'

import type {
  EditorHost,
  IHitTestResult,
  IHitTestService,
} from '@latte-js/syrup'

export class RendererHitTestService implements IHitTestService {
  private _graph: SceneGraph
  private readonly _hitTester: HitTester

  constructor(
    private readonly _host: EditorHost<SceneGraph>,
    private readonly _renderer: Renderer,
    private readonly _viewport: HTMLElement
  ) {
    this._graph = this._host.graph
    this._hitTester = new HitTester(this._graph, this._renderer.camera)
  }

  public hitTest(clientX: number, clientY: number): IHitTestResult {
    this._syncGraph()

    const rect = this._viewport.getBoundingClientRect()
    const localX = clientX - rect.left
    const localY = clientY - rect.top
    const viewport = { x: localX, y: localY }
    const world = this._renderer.camera.toWorld(localX, localY)

    return (
      this._graph.readConsistent(() => {
        const activeRootId = this._renderer.activeRootId
        const layerHit = this._renderer.hitTestLayers({ viewport, world })
        if (layerHit) {
          return {
            hitResult: {
              kind: 'render-layer',
              layerId: layerHit.layerId,
              targetId: layerHit.targetId,
              payload: layerHit.data,
            },
            viewport,
            world,
          }
        }

        if (!activeRootId) {
          return { hitResult: undefined, viewport, world }
        }

        const indexedCandidates = this._renderer.queryHitTestCandidates(
          world.x,
          world.y,
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
          return { hitResult: undefined, viewport, world }
        }

        return {
          hitResult: {
            nodeIndex,
            nodeId: this._graph.getUUID(nodeIndex) || undefined,
          },
          viewport,
          world,
        }
      }) ?? {
        hitResult: undefined,
        viewport,
        world,
      }
    )
  }

  private _syncGraph() {
    if (this._graph === this._host.graph) {
      return
    }

    this._graph = this._host.graph
    this._hitTester.setGraph(this._graph)
  }
}
