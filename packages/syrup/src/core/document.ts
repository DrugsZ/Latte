import { SceneGraph } from '@latte-js/espresso'

import type { IDocument as IBaseDocument } from '@latte-js/bean'

export type IDocument = IBaseDocument<SceneGraph>

export class LatteDocument implements IDocument {
  public isDirty = false
  public readonly graph: SceneGraph

  constructor(
    public readonly id: string,
    public readonly uri: string
  ) {
    this.graph = new SceneGraph()
  }
}
