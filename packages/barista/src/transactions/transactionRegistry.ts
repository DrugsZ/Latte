import { DEFAULT_SCENE_GRAPH_NAME } from '@latte-js/bean'
import type {
  ISceneGraphMutationAuthority,
  SceneGraph,
} from '@latte-js/espresso'

import { HistoryManager } from '../history/historyManager'
import { TransactionManager } from './transactionManager'

const transactionManagers = new WeakMap<
  SceneGraph,
  Map<string, TransactionManager>
>()
const historyManagers = new WeakMap<SceneGraph, HistoryManager>()

const normalizeResourceId = (resourceId = DEFAULT_SCENE_GRAPH_NAME) =>
  resourceId || DEFAULT_SCENE_GRAPH_NAME

export const getTransactionManager = (
  sceneGraph: SceneGraph,
  resourceId = DEFAULT_SCENE_GRAPH_NAME
) => {
  resourceId = normalizeResourceId(resourceId)
  let managers = transactionManagers.get(sceneGraph)
  if (!managers) {
    managers = new Map()
    transactionManagers.set(sceneGraph, managers)
  }

  let manager = managers.get(resourceId)
  if (!manager) {
    manager = new TransactionManager(sceneGraph)
    managers.set(resourceId, manager)
  }
  return manager
}

export const getHistoryManager = (
  sceneGraph: SceneGraph,
  mutationAuthority?: ISceneGraphMutationAuthority
) => {
  let manager = historyManagers.get(sceneGraph)
  if (!manager) {
    manager = new HistoryManager(sceneGraph, mutationAuthority)
    historyManagers.set(sceneGraph, manager)
  } else if (mutationAuthority) {
    manager.setMutationAuthority(mutationAuthority)
  }
  return manager
}
