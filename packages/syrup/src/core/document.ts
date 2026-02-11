import { MAX_NODES, SceneGraph, TOTAL_MEMORY_BYTES } from '@latte-js/espresso'

import type { IDocument as IBaseDocument } from '@latte-js/bean'

export type IDocument = IBaseDocument<SceneGraph>

export class LatteDocument implements IDocument {
  public isDirty = false
  public readonly graph: SceneGraph

  constructor(
    public readonly id: string,
    public readonly uri: string
  ) {
    const sharedBuffer = new SharedArrayBuffer(TOTAL_MEMORY_BYTES)
    const allocBuffer = new SharedArrayBuffer(MAX_NODES)
    this.graph = new SceneGraph(sharedBuffer, allocBuffer)
  }
}
