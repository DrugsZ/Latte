import type {
  ISceneGraphMutationAuthority,
  SceneGraph,
} from '@latte-js/espresso'

export class BaristaSession {
  private _projectionVersion = 0

  constructor(
    public readonly id: string,
    public readonly sceneGraph: SceneGraph,
    public readonly mutationAuthority: ISceneGraphMutationAuthority
  ) {}

  public nextProjectionVersion() {
    this._projectionVersion += 1
    return this._projectionVersion
  }
}
