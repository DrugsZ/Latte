import {
  MAT_SIZE,
  MAX_NODES,
  NULL_INDEX,
  NodeCursor,
  type SceneGraph,
} from '@latte-js/espresso'
import { mat2d } from 'gl-matrix'

import { getNodeCommandEncoder } from './nodeCommandEncoderRegistry'

import {
  type IRenderCommandEncoder,
  type Paint,
  type RenderPassClear,
  type Shader,
  type ShaderRef,
  type BlendMode,
  RenderCommandBuffer,
  RenderCommandType,
} from '../contract/renderBackend'

import type { RenderFrame } from './renderFrameBuilder'

export interface RenderCommandEncodeOptions {
  readonly frame: RenderFrame
  readonly sceneGraph: SceneGraph
  readonly cameraMatrix: mat2d
  readonly clearBounds?: RenderPassClear
}

export class RenderCommandEncoder implements IRenderCommandEncoder {
  private readonly _tempMatrix = mat2d.create()
  private _buffer = new RenderCommandBuffer()
  private _currentTransform = new Float32Array([1, 0, 0, 1, 0, 0])
  private readonly _opacityByIndex = new Map<number, number>()

  public encode(options: RenderCommandEncodeOptions) {
    const { frame, sceneGraph, cameraMatrix, clearBounds } = options
    const buffer = new RenderCommandBuffer()
    this._buffer = buffer
    this._opacityByIndex.clear()

    if (clearBounds) {
      buffer.setClear(clearBounds)
    }

    const node =
      frame.nodeIndices.length > 0
        ? new NodeCursor(sceneGraph, frame.nodeIndices[0])
        : null
    const rootIndex = sceneGraph.getIndex(frame.activeRootId)
    let openPath: number[] = []

    for (let i = 0; i < frame.nodeIndices.length; i += 1) {
      const index = frame.nodeIndices[i]
      const path = this._nodePath(sceneGraph, index, rootIndex)
      if (
        !path ||
        path.some(ancestor => this._nodeOpacity(sceneGraph, ancestor) === 0)
      ) {
        continue
      }
      let common = 0
      while (
        common < openPath.length &&
        common < path.length &&
        openPath[common] === path[common]
      )
        common++
      for (let end = openPath.length - 1; end >= common; end--) {
        if (this._nodeOpacity(sceneGraph, openPath[end]) < 1) this.pop()
      }
      for (let start = common; start < path.length; start++) {
        const opacity = this._nodeOpacity(sceneGraph, path[start])
        if (opacity < 1) this.pushLayer(opacity)
      }
      openPath = path
      if (i > 0) {
        node!.to(index)
      }
      this._setCurrentTransform(sceneGraph, index, cameraMatrix)

      const nodeEncoder = getNodeCommandEncoder(node!.type)
      nodeEncoder?.encode(this, node!)
    }
    for (let end = openPath.length - 1; end >= 0; end--) {
      if (this._nodeOpacity(sceneGraph, openPath[end]) < 1) this.pop()
    }

    return buffer
  }

  private _nodeOpacity(graph: SceneGraph, index: number) {
    const cached = this._opacityByIndex.get(index)
    if (cached !== undefined) return cached
    const opacity = graph.opacity[index]
    const normalized = Number.isFinite(opacity)
      ? Math.max(0, Math.min(1, opacity))
      : 1
    this._opacityByIndex.set(index, normalized)
    return normalized
  }

  private _nodePath(graph: SceneGraph, index: number, rootIndex: number) {
    const path: number[] = []
    const visited = new Set<number>()
    let current = index
    while (current !== NULL_INDEX) {
      if (visited.has(current) || visited.size > MAX_NODES)
        throw new Error('Tree cycle detected while encoding opacity')
      visited.add(current)
      path.push(current)
      if (current === rootIndex) return path.reverse()
      current = graph.parent[current]
    }
    return null
  }

  public createShader(shader: Shader): ShaderRef {
    return this._buffer.createShader(shader)
  }

  public drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    cornerRadius: number | Float32Array,
    paint: Paint
  ) {
    this._buffer.push({
      type: RenderCommandType.DrawRect,
      transform: this._copyCurrentTransform(),
      x,
      y,
      width,
      height,
      cornerRadius: this._copyCornerRadius(cornerRadius),
      paint,
    })
  }

  public drawEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rotation: number,
    paint: Paint
  ) {
    this._buffer.push({
      type: RenderCommandType.DrawEllipse,
      transform: this._copyCurrentTransform(),
      cx,
      cy,
      rx,
      ry,
      rotation,
      paint,
    })
  }

  public drawPath(pathId: number, paint: Paint) {
    this._buffer.push({
      type: RenderCommandType.DrawPath,
      transform: this._copyCurrentTransform(),
      pathId,
      paint,
    })
  }

  public drawText(
    text: string,
    x: number,
    y: number,
    fontId: string,
    fontSize: number,
    paint: Paint,
    align?: 'left' | 'center' | 'right',
    baseline?: 'top' | 'middle' | 'bottom' | 'alphabetic',
    maxWidth?: number
  ) {
    this._buffer.push({
      type: RenderCommandType.DrawText,
      transform: this._copyCurrentTransform(),
      text,
      x,
      y,
      fontId,
      fontSize,
      paint,
      align,
      baseline,
      maxWidth,
    })
  }

  public drawImage(
    imageId: string,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    sx?: number,
    sy?: number,
    sw?: number,
    sh?: number,
    paint?: Paint
  ) {
    this._buffer.push({
      type: RenderCommandType.DrawImage,
      transform: this._copyCurrentTransform(),
      imageId,
      dx,
      dy,
      dw,
      dh,
      sx,
      sy,
      sw,
      sh,
      paint,
    })
  }

  public pushClipRect(x: number, y: number, width: number, height: number) {
    this._buffer.push({
      type: RenderCommandType.PushClipRect,
      transform: this._copyCurrentTransform(),
      x,
      y,
      width,
      height,
    })
  }

  public pushClipPath(pathId: number) {
    this._buffer.push({
      type: RenderCommandType.PushClipPath,
      transform: this._copyCurrentTransform(),
      pathId,
    })
  }

  public pushLayer(
    alpha?: number,
    blendMode?: BlendMode,
    bounds?: RenderPassClear
  ) {
    this._buffer.push({
      type: RenderCommandType.PushLayer,
      alpha,
      blendMode,
      bounds,
    })
  }

  public pop() {
    this._buffer.push({
      type: RenderCommandType.Pop,
    })
  }

  private _setCurrentTransform(
    sceneGraph: SceneGraph,
    index: number,
    cameraMatrix: mat2d
  ) {
    const ptr = index * MAT_SIZE
    mat2d.set(
      this._tempMatrix,
      sceneGraph.worldMatrix[ptr],
      sceneGraph.worldMatrix[ptr + 1],
      sceneGraph.worldMatrix[ptr + 2],
      sceneGraph.worldMatrix[ptr + 3],
      sceneGraph.worldMatrix[ptr + 4],
      sceneGraph.worldMatrix[ptr + 5]
    )
    mat2d.multiply(this._tempMatrix, cameraMatrix, this._tempMatrix)
    this._currentTransform = Float32Array.from(this._tempMatrix)
  }

  private _copyCurrentTransform() {
    return Float32Array.from(this._currentTransform)
  }

  private _copyCornerRadius(cornerRadius: number | Float32Array) {
    return typeof cornerRadius === 'number'
      ? cornerRadius
      : Float32Array.from(cornerRadius)
  }
}
