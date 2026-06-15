import { NodeType } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SelectionService } from '../selectionService'

describe('SelectionService', () => {
  let sceneGraph: SceneGraph
  let selectionService: SelectionService

  beforeEach(() => {
    sceneGraph = new SceneGraph()
    selectionService = new SelectionService(sceneGraph)
  })

  it('should start empty', () => {
    expect(selectionService.isEmpty).toBe(true)
    expect(selectionService.ids).toEqual([])
    expect(selectionService.indices).toEqual([])
  })

  it('should select ids', () => {
    const spy = vi.fn()
    selectionService.onSelectChange(spy)

    selectionService.select(['test:a', 'test:b', 'test:c'])

    expect(selectionService.isEmpty).toBe(false)
    expect(selectionService.ids).toEqual(
      expect.arrayContaining(['test:a', 'test:b', 'test:c'])
    )
    expect(selectionService.activeId).toBe('test:c')
    expect(selectionService.anchorId).toBe('test:a')
    expect(spy).toHaveBeenCalledWith(
      expect.arrayContaining(['test:a', 'test:b', 'test:c'])
    )
  })

  it('should clear selection', () => {
    selectionService.select(['test:a', 'test:b'])
    const spy = vi.fn()
    selectionService.onSelectChange(spy)

    selectionService.clear()

    expect(selectionService.isEmpty).toBe(true)
    expect(selectionService.ids).toEqual([])
    expect(selectionService.indices).toEqual([])
    expect(spy).toHaveBeenCalledWith([])
  })

  it('should toggle selection', () => {
    const spy = vi.fn()
    selectionService.onSelectChange(spy)

    selectionService.toggle('test:a')
    expect(selectionService.ids).toEqual(['test:a'])
    expect(spy).toHaveBeenCalledTimes(1)

    selectionService.toggle('test:a')
    expect(selectionService.ids).toEqual([])
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('should iterate over selected cursors', () => {
    const a = sceneGraph.createNode(NodeType.RECTANGLE, 'test:a')
    const b = sceneGraph.createNode(NodeType.FRAME, 'test:b')
    selectionService.select(['test:a', 'test:b'])

    const indices: number[] = []
    selectionService.forEach(cursor => {
      indices.push(cursor.index)
    })

    expect(indices).toEqual(expect.arrayContaining([a, b]))
  })

  it('should map selected cursors', () => {
    const a = sceneGraph.createNode(NodeType.RECTANGLE, 'test:a')
    const b = sceneGraph.createNode(NodeType.FRAME, 'test:b')
    selectionService.select(['test:a', 'test:b'])

    const result = selectionService.map(cursor => cursor.index * 2)

    expect(result).toEqual(expect.arrayContaining([a * 2, b * 2]))
  })

  it('resolves indices from the current graph and clears on graph switch', () => {
    const a = sceneGraph.createNode(NodeType.RECTANGLE, 'test:a')
    selectionService.select(['test:a'])

    expect(selectionService.indices).toEqual([a])

    selectionService.setGraph(new SceneGraph())

    expect(selectionService.ids).toEqual([])
    expect(selectionService.indices).toEqual([])
  })
})
