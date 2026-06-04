import type { SceneGraph } from '@latte-js/espresso'
import { HistoryManager } from '../history/historyManager'
import { TransactionManager } from './transactionManager'

const transactionManagers = new WeakMap<SceneGraph, TransactionManager>()
const historyManagers = new WeakMap<SceneGraph, HistoryManager>()

export const getTransactionManager = (sceneGraph: SceneGraph) => {
  let manager = transactionManagers.get(sceneGraph)
  if (!manager) {
    manager = new TransactionManager(sceneGraph)
    transactionManagers.set(sceneGraph, manager)
  }
  return manager
}

export const getHistoryManager = (sceneGraph: SceneGraph) => {
  let manager = historyManagers.get(sceneGraph)
  if (!manager) {
    manager = new HistoryManager(sceneGraph, getTransactionManager(sceneGraph))
    historyManagers.set(sceneGraph, manager)
  }
  return manager
}
