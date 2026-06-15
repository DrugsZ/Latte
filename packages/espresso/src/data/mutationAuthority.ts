const SCENE_GRAPH_MUTATION_AUTHORITY = Symbol('SceneGraphMutationAuthority')

export interface ISceneGraphMutationAuthority {
  readonly owner: string
  readonly [SCENE_GRAPH_MUTATION_AUTHORITY]: true
}

export const createSceneGraphMutationAuthority = (
  owner: string
): ISceneGraphMutationAuthority =>
  Object.freeze({
    owner,
    [SCENE_GRAPH_MUTATION_AUTHORITY]: true as const,
  })

export const isSceneGraphMutationAuthority = (
  value: unknown
): value is ISceneGraphMutationAuthority =>
  typeof value === 'object' &&
  value !== null &&
  (value as Record<PropertyKey, unknown>)[SCENE_GRAPH_MUTATION_AUTHORITY] ===
    true
