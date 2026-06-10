import {
  DIRTY_WORLD_BOUNDS,
  DIRTY_SUBTREE_MATRIX,
  MATRIX_AFFECTING_FLAGS,
  MAT_SIZE,
  MAX_NODES,
  NULL_INDEX,
} from '@latte-js/espresso'

import type { DirtyBatch } from '../pipeline/dirtyBatch'
import { ScheduleStage, system, SystemBase, Systems } from './systems'

const MATRIX_SCHEDULE_READS = MATRIX_AFFECTING_FLAGS | DIRTY_SUBTREE_MATRIX

enum MatrixTraversalPhase {
  Enter = 'enter',
  Exit = 'exit',
}

interface MatrixTraversalFrame {
  readonly index: number
  readonly parentUpdated: boolean
  readonly phase: MatrixTraversalPhase
}

/**
 * MatrixSystem - Computes world transform matrices using DIRTY_SUBTREE_MATRIX pruning.
 *
 * Traverses top-down, skipping subtrees without transform changes.
 * Marks updated nodes with DIRTY_WORLD_BOUNDS for AABBSystem to process.
 */
@system({
  schedule: {
    stage: ScheduleStage.Matrix,
    reads: MATRIX_SCHEDULE_READS,
    writes: DIRTY_WORLD_BOUNDS,
  },
})
export class MatrixSystem extends SystemBase {
  public static readonly name = Systems.Matrix

  public process(batch: DirtyBatch) {
    if (!batch.hasChanges) return

    const roots = this._collectTraversalRoots(batch)
    const visited = new Set<number>()
    const visiting = new Set<number>()

    for (const root of roots) {
      this._processFromRoot(root, batch, visited, visiting)
    }
  }

  private _collectTraversalRoots(batch: DirtyBatch) {
    const candidates = new Set(batch.keysByMask(MATRIX_SCHEDULE_READS))
    const roots: number[] = []

    for (const index of candidates) {
      this._sceneGraph.assertNodeIndexAlive(index, 'MatrixSystem.process')
      const parent = this._sceneGraph.parent[index]
      if (parent === NULL_INDEX || !candidates.has(parent)) {
        roots.push(index)
      }
    }

    if (roots.length === 0 && candidates.size > 0) {
      throw new Error('Tree cycle detected in matrix traversal roots')
    }

    return roots
  }

  private _processFromRoot(
    root: number,
    batch: DirtyBatch,
    visited: Set<number>,
    visiting: Set<number>
  ) {
    const stack: MatrixTraversalFrame[] = [
      {
        index: root,
        parentUpdated: false,
        phase: MatrixTraversalPhase.Enter,
      },
    ]

    while (stack.length > 0) {
      const frame = stack.pop()!

      if (frame.phase === MatrixTraversalPhase.Exit) {
        visiting.delete(frame.index)
        continue
      }

      this._enterNode(frame, batch, stack, visited, visiting)
    }
  }

  private _enterNode(
    frame: MatrixTraversalFrame,
    batch: DirtyBatch,
    stack: MatrixTraversalFrame[],
    visited: Set<number>,
    visiting: Set<number>
  ) {
    const { index, parentUpdated } = frame

    if (visiting.has(index) || visiting.size > MAX_NODES) {
      throw new Error(`Tree cycle detected at node ${index}`)
    }
    if (visited.has(index)) {
      return
    }

    this._sceneGraph.assertNodeIndexAlive(index, 'MatrixSystem.traverse')
    visiting.add(index)
    visited.add(index)

    const flags = batch.getFlags(index)
    const hasMatrixInputChange = (flags & MATRIX_AFFECTING_FLAGS) !== 0
    const hasDirtySubtree = (flags & DIRTY_SUBTREE_MATRIX) !== 0

    if (!parentUpdated && !hasMatrixInputChange && !hasDirtySubtree) {
      visiting.delete(index)
      return
    }

    const mustUpdate = hasMatrixInputChange || parentUpdated

    if (mustUpdate) {
      this._updateWorldTransform(index)
      batch.markDerived(index, DIRTY_WORLD_BOUNDS)
    }

    stack.push({ index, parentUpdated, phase: MatrixTraversalPhase.Exit })

    if (hasDirtySubtree || mustUpdate) {
      this._pushChildren(index, mustUpdate, batch, stack)
    }
  }

  private _pushChildren(
    index: number,
    parentUpdated: boolean,
    batch: DirtyBatch,
    stack: MatrixTraversalFrame[]
  ) {
    const children: number[] = []
    const visitedChildren = new Set<number>()
    let child = this._sceneGraph.firstChild[index]

    while (child !== NULL_INDEX) {
      if (visitedChildren.has(child) || visitedChildren.size > MAX_NODES) {
        throw new Error(`Tree cycle detected at node ${child}`)
      }

      this._sceneGraph.assertNodeIndexAlive(child, 'MatrixSystem.child')
      visitedChildren.add(child)

      if (parentUpdated || batch.hasFlags(child, MATRIX_SCHEDULE_READS)) {
        children.push(child)
      }

      child = this._sceneGraph.nextSibling[child]
    }

    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push({
        index: children[i],
        parentUpdated,
        phase: MatrixTraversalPhase.Enter,
      })
    }
  }

  private _updateWorldTransform(index: number) {
    const graph = this._sceneGraph
    const parent = graph.parent[index]
    const local = index * MAT_SIZE
    const world = index * MAT_SIZE

    if (parent === NULL_INDEX) {
      graph.worldMatrix[world + 0] = graph.matrix[local + 0]
      graph.worldMatrix[world + 1] = graph.matrix[local + 1]
      graph.worldMatrix[world + 2] = graph.matrix[local + 2]
      graph.worldMatrix[world + 3] = graph.matrix[local + 3]
      graph.worldMatrix[world + 4] = graph.matrix[local + 4]
      graph.worldMatrix[world + 5] = graph.matrix[local + 5]
      return
    }

    graph.assertNodeIndexAlive(parent, 'MatrixSystem.parent')
    const parentWorld = parent * MAT_SIZE
    const pa = graph.worldMatrix[parentWorld + 0]
    const pb = graph.worldMatrix[parentWorld + 1]
    const pc = graph.worldMatrix[parentWorld + 2]
    const pd = graph.worldMatrix[parentWorld + 3]
    const ptx = graph.worldMatrix[parentWorld + 4]
    const pty = graph.worldMatrix[parentWorld + 5]
    const la = graph.matrix[local + 0]
    const lb = graph.matrix[local + 1]
    const lc = graph.matrix[local + 2]
    const ld = graph.matrix[local + 3]
    const ltx = graph.matrix[local + 4]
    const lty = graph.matrix[local + 5]

    graph.worldMatrix[world + 0] = pa * la + pc * lb
    graph.worldMatrix[world + 1] = pb * la + pd * lb
    graph.worldMatrix[world + 2] = pa * lc + pc * ld
    graph.worldMatrix[world + 3] = pb * lc + pd * ld
    graph.worldMatrix[world + 4] = pa * ltx + pc * lty + ptx
    graph.worldMatrix[world + 5] = pb * ltx + pd * lty + pty
  }
}
