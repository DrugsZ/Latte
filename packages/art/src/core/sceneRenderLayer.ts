import { NodeType, type IDType } from '@latte-js/bean'
import {
  MAT_SIZE,
  MAX_NODES,
  NodeLifecycle,
  NULL_INDEX,
  type SceneGraph,
} from '@latte-js/espresso'
import { mat2d } from 'gl-matrix'

import { RenderCommandEncoder } from './renderCommandEncoder'
import { RenderFrameBuilder, type RenderFrame } from './renderFrameBuilder'
import { RenderSceneIndex } from './renderSceneIndex'
import { RenderCommandBuffer } from '../contract/renderBackend'

import type { RenderLayer, RenderLayerEncodeContext } from './renderLayer'

export const SCENE_RENDER_LAYER_ID = 'scene'

export class SceneRenderLayer implements RenderLayer {
  public readonly id = SCENE_RENDER_LAYER_ID
  public readonly zIndex = 0

  private readonly _commandEncoder = new RenderCommandEncoder()
  private readonly _sceneIndex: RenderSceneIndex
  private readonly _frameBuilder: RenderFrameBuilder
  private _lastFrame: RenderFrame | null = null

  constructor(private _sceneGraph: SceneGraph) {
    this._sceneIndex = new RenderSceneIndex(this._sceneGraph)
    this._frameBuilder = new RenderFrameBuilder(this._sceneIndex)
  }

  public get sceneIndex() {
    return this._sceneIndex
  }

  public get lastFrame() {
    return this._lastFrame
  }

  public setGraph(graph: SceneGraph) {
    this._sceneGraph = graph
    this._sceneIndex.setGraph(graph)
    this._lastFrame = null
  }

  public encode(context: RenderLayerEncodeContext) {
    const { activeRootId, backendSize, camera, reasons } = context
    if (!activeRootId) {
      this._lastFrame = null
      return this._createClearBuffer(backendSize)
    }

    const frame = this._frameBuilder.build({
      activeRootId,
      viewportBounds: camera.getViewportBounds(),
      reasons,
    })
    if (!frame) {
      this._lastFrame = null
      return this._createClearBuffer(backendSize)
    }

    const commands = this._commandEncoder.encode({
      frame,
      sceneGraph: this._sceneGraph,
      cameraMatrix: camera.getMatrix(),
      clearBounds: {
        x: 0,
        y: 0,
        width: backendSize.width,
        height: backendSize.height,
      },
    })
    this._lastFrame = frame
    return commands
  }

  public rebuildSceneIndex() {
    this._sceneIndex.rebuild()
  }

  public updateSceneIndexByIds(ids: Iterable<IDType>) {
    this._sceneIndex.updateByIds(ids)
  }

  public queryHitTestCandidates(
    worldX: number,
    worldY: number,
    rootId?: IDType | null
  ) {
    if (!rootId) {
      return []
    }
    return this._sceneIndex.filterRenderableCandidates(
      this._sceneIndex.queryPointCandidates(worldX, worldY),
      rootId
    )
  }

  public computeContentBounds(rootId: IDType) {
    const rootIndex = this._sceneGraph.getIndex(rootId)
    if (rootIndex === NULL_INDEX) {
      return null
    }

    const identity = mat2d.create()
    const stack: { index: number; parentMatrix: mat2d }[] = [
      { index: rootIndex, parentMatrix: identity },
    ]
    const visited = new Set<number>()
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    while (stack.length) {
      const { index, parentMatrix } = stack.pop()!
      if (visited.has(index)) {
        throw new Error(`Tree cycle detected at node ${index}`)
      }
      if (visited.size > MAX_NODES) {
        throw new Error('Tree cycle detected')
      }

      visited.add(index)
      if (!this._isRenderableNode(index)) {
        continue
      }

      const local = this._sceneGraph.matrix.subarray(
        index * MAT_SIZE,
        index * MAT_SIZE + MAT_SIZE
      ) as mat2d
      const world = mat2d.create()
      mat2d.multiply(world, parentMatrix, local)

      const type = this._sceneGraph.type[index]
      const width = this._sceneGraph.size[index * 2]
      const height = this._sceneGraph.size[index * 2 + 1]
      if (
        type !== NodeType.DOCUMENT &&
        type !== NodeType.CANVAS &&
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width > 0 &&
        height > 0
      ) {
        const corners = [
          [0, 0],
          [width, 0],
          [width, height],
          [0, height],
        ]
        for (const [x, y] of corners) {
          const tx = world[0] * x + world[2] * y + world[4]
          const ty = world[1] * x + world[3] * y + world[5]
          minX = Math.min(minX, tx)
          minY = Math.min(minY, ty)
          maxX = Math.max(maxX, tx)
          maxY = Math.max(maxY, ty)
        }
      }

      const children: number[] = []
      let childIdx = this._sceneGraph.firstChild[index]
      const visitedChildren = new Set<number>()
      while (childIdx !== NULL_INDEX) {
        if (visitedChildren.has(childIdx)) {
          throw new Error(`Tree cycle detected at node ${childIdx}`)
        }
        visitedChildren.add(childIdx)
        children.push(childIdx)
        childIdx = this._sceneGraph.nextSibling[childIdx]
      }
      for (let i = children.length - 1; i >= 0; i -= 1) {
        stack.push({ index: children[i], parentMatrix: world })
      }
    }

    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY)
    ) {
      return null
    }

    return { minX, minY, maxX, maxY }
  }

  private _createClearBuffer(backendSize: { width: number; height: number }) {
    const commands = new RenderCommandBuffer()
    commands.setClear({
      x: 0,
      y: 0,
      width: backendSize.width,
      height: backendSize.height,
    })
    return commands
  }

  private _isRenderableNode(index: number) {
    return (
      (this._sceneGraph.lifecycle[index] & NodeLifecycle.Active) !== 0 &&
      this._sceneGraph.visible[index] === 1
    )
  }
}
