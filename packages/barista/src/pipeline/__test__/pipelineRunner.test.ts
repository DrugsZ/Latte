import { NodeType } from '@latte-js/bean'
import {
  DIRTY_LOCAL_MATRIX,
  DIRTY_METADATA,
  SceneGraph,
} from '@latte-js/espresso'
import { describe, expect, it, vi } from 'vitest'

import type { AABBSystem, MatrixSystem} from '../../systems';
import { BaristaSystem, Systems } from '../../systems'
import { DirtyBatch } from '../dirtyBatch'
import { PipelineRunner } from '../pipelineRunner'

describe('PipelineRunner', () => {
  it('skips pipeline systems when their declared dirty input is absent', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const systems = new BaristaSystem(graph)
    const runner = new PipelineRunner(systems)
    const matrix = systems.getSystem<MatrixSystem>(Systems.Matrix)
    const aabb = systems.getSystem<AABBSystem>(Systems.AABB)
    const matrixProcess = vi.spyOn(matrix, 'process')
    const aabbProcess = vi.spyOn(aabb, 'process')

    runner.process(DirtyBatch.from(new Map([[index, DIRTY_METADATA]])))

    expect(matrixProcess).not.toHaveBeenCalled()
    expect(aabbProcess).not.toHaveBeenCalled()
  })

  it('runs systems whose declared dirty input is present', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const systems = new BaristaSystem(graph)
    const runner = new PipelineRunner(systems)
    const matrix = systems.getSystem<MatrixSystem>(Systems.Matrix)
    const aabb = systems.getSystem<AABBSystem>(Systems.AABB)
    const matrixProcess = vi.spyOn(matrix, 'process')
    const aabbProcess = vi.spyOn(aabb, 'process')

    runner.process(DirtyBatch.from(new Map([[index, DIRTY_LOCAL_MATRIX]])))

    expect(matrixProcess).toHaveBeenCalledTimes(1)
    expect(aabbProcess).toHaveBeenCalledTimes(1)
  })
})
