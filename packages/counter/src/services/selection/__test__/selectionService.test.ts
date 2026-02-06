import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SelectionService } from '../selectionService'
import { SceneGraph } from '@latte-js/espresso'

describe('SelectionService', () => {
  let sceneGraph: SceneGraph
  let selectionService: SelectionService

  beforeEach(() => {
    sceneGraph = new SceneGraph()
    selectionService = new SelectionService(sceneGraph)
  })

  it('should start empty', () => {
    expect(selectionService.isEmpty).toBe(true)
    expect(selectionService.indices).toEqual([])
  })

  it('should select indices', () => {
    const spy = vi.fn()
    selectionService.onSelectChange(spy)

    selectionService.select([1, 2, 3])
    
    expect(selectionService.isEmpty).toBe(false)
    expect(selectionService.indices).toEqual(expect.arrayContaining([1, 2, 3]))
    expect(spy).toHaveBeenCalledWith(expect.arrayContaining([1, 2, 3]))
  })

  it('should clear selection', () => {
    selectionService.select([1, 2])
    const spy = vi.fn()
    selectionService.onSelectChange(spy)

    selectionService.clear()
    
    expect(selectionService.isEmpty).toBe(true)
    expect(selectionService.indices).toEqual([])
    expect(spy).toHaveBeenCalledWith([])
  })

  it('should toggle selection', () => {
    const spy = vi.fn()
    selectionService.onSelectChange(spy)

    // Select 1
    selectionService.toggle(1)
    expect(selectionService.indices).toEqual([1])
    expect(spy).toHaveBeenCalledTimes(1)

    // Deselect 1
    selectionService.toggle(1)
    expect(selectionService.indices).toEqual([])
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('should iterate over selected cursors', () => {
    // We need actual nodes in sceneGraph for cursor to work effectively?
    // NodeCursor just wraps index, so it might work even if empty, 
    // but let's be safe and assume valid indices.
    // However, SelectionService just sets indices.
    
    selectionService.select([10, 20])
    
    const indices: number[] = []
    selectionService.forEach(cursor => {
      indices.push(cursor.index)
    })
    
    expect(indices).toEqual(expect.arrayContaining([10, 20]))
  })

  it('should map selected cursors', () => {
    selectionService.select([10, 20])
    
    const result = selectionService.map(cursor => cursor.index * 2)
    
    expect(result).toEqual(expect.arrayContaining([20, 40]))
  })
})
