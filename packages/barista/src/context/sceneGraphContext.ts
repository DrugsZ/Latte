import { DEFAULT_SCENE_GRAPH_NAME } from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'

export interface ISceneGraphContext {
  readonly sceneGraph: SceneGraph
  readonly currentSessionId: string
}

export interface ISceneGraphContextScope extends ISceneGraphContext {
  runWithContext<T>(
    context: ISceneGraphContext,
    invoke: () => T | Promise<T>
  ): T | Promise<T>
}

export type SceneGraphContextSource = SceneGraph | ISceneGraphContext

export const createStaticSceneGraphContext = (
  sceneGraph: SceneGraph,
  currentSessionId = DEFAULT_SCENE_GRAPH_NAME
): ISceneGraphContext => ({
  sceneGraph,
  currentSessionId,
})

export const toSceneGraphContext = (
  source: SceneGraphContextSource
): ISceneGraphContext => {
  if ('sceneGraph' in source && 'currentSessionId' in source) {
    return source
  }
  return createStaticSceneGraphContext(source)
}
