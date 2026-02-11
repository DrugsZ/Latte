import { NodeType } from '@latte-js/bean'
import { SceneGraph, NULL_INDEX } from '@latte-js/espresso'
import { describe, it, expect, beforeEach } from 'vitest'

import { Camera } from '../../core/camera'
import { HitTester } from '../hitTester'

describe('HitTester', () => {
  let sceneGraph: SceneGraph
  let camera: Camera
  let hitTester: HitTester

  beforeEach(() => {
    sceneGraph = new SceneGraph()
    camera = new Camera(1000, 1000)
    hitTester = new HitTester(sceneGraph, camera)
  })

  it('should hit test a simple rectangle', () => {
    const rootId = 'test:root'
    const rootIndex = sceneGraph.createNode(NodeType.GROUP, rootId)

    const rectId = 'test:rect1'
    const rectIndex = sceneGraph.createNode(NodeType.RECTANGLE, rectId)

    sceneGraph.appendChild(rootIndex, rectIndex)

    // Setup Rect Geometry
    // 1. Set Size (100x100)
    sceneGraph.size[rectIndex * 2] = 100
    sceneGraph.size[rectIndex * 2 + 1] = 100

    // 2. Set World Matrix (Translate 10, 10)
    const matPtr = rectIndex * 6
    // mat2d: a, b, c, d, tx, ty
    // Identity + translate 10, 10
    sceneGraph.worldMatrix[matPtr] = 1 // a
    sceneGraph.worldMatrix[matPtr + 1] = 0 // b
    sceneGraph.worldMatrix[matPtr + 2] = 0 // c
    sceneGraph.worldMatrix[matPtr + 3] = 1 // d
    sceneGraph.worldMatrix[matPtr + 4] = 10 // tx
    sceneGraph.worldMatrix[matPtr + 5] = 10 // ty

    // 3. Set AABB (10, 10, 110, 110)
    const aabbPtr = rectIndex * 4
    sceneGraph.aabb[aabbPtr] = 10 // minX
    sceneGraph.aabb[aabbPtr + 1] = 10 // minY
    sceneGraph.aabb[aabbPtr + 2] = 110 // maxX
    sceneGraph.aabb[aabbPtr + 3] = 110 // maxY

    // Set Root AABB to cover children
    const rootAabbPtr = rootIndex * 4
    sceneGraph.aabb[rootAabbPtr] = 0
    sceneGraph.aabb[rootAabbPtr + 1] = 0
    sceneGraph.aabb[rootAabbPtr + 2] = 1000
    sceneGraph.aabb[rootAabbPtr + 3] = 1000

    // Test Hit inside
    // Camera(1000, 1000) centers 0,0 world at 500,500 screen.
    // We want to hit world 60,60.
    // Screen = World + 500 => 560, 560.
    const result = hitTester.hitTest(560, 560, rootId)
    expect(result).toBe(rectIndex)

    // Test Miss
    // World 200, 200 -> Screen 700, 700
    const resultMiss = hitTester.hitTest(700, 700, rootId)
    expect(resultMiss).toBe(NULL_INDEX)
  })

  it('should respect z-order (reverse traversal)', () => {
    const rootId = 'test:root'
    const rootIndex = sceneGraph.createNode(NodeType.GROUP, rootId)

    // Set Root AABB
    const rootAabbPtr = rootIndex * 4
    sceneGraph.aabb[rootAabbPtr] = 0
    sceneGraph.aabb[rootAabbPtr + 1] = 0
    sceneGraph.aabb[rootAabbPtr + 2] = 1000
    sceneGraph.aabb[rootAabbPtr + 3] = 1000

    // Rect 1 (Bottom)
    const rect1Index = sceneGraph.createNode(NodeType.RECTANGLE, 'test:rect1')
    sceneGraph.appendChild(rootIndex, rect1Index)

    // Rect 2 (Top) covering Rect 1 partially
    const rect2Index = sceneGraph.createNode(NodeType.RECTANGLE, 'test:rect2')
    sceneGraph.appendChild(rootIndex, rect2Index)

    // Rect 1: 0,0 100x100
    const sizePtr1 = rect1Index * 2
    sceneGraph.size[sizePtr1] = 100
    sceneGraph.size[sizePtr1 + 1] = 100

    const matPtr1 = rect1Index * 6
    sceneGraph.worldMatrix[matPtr1] = 1
    sceneGraph.worldMatrix[matPtr1 + 3] = 1
    sceneGraph.worldMatrix[matPtr1 + 4] = 0
    sceneGraph.worldMatrix[matPtr1 + 5] = 0

    const aabbPtr1 = rect1Index * 4
    sceneGraph.aabb[aabbPtr1] = 0
    sceneGraph.aabb[aabbPtr1 + 1] = 0
    sceneGraph.aabb[aabbPtr1 + 2] = 100
    sceneGraph.aabb[aabbPtr1 + 3] = 100

    // Rect 2: 50,50 100x100 (overlaps 50,50 to 100,100)
    const sizePtr2 = rect2Index * 2
    sceneGraph.size[sizePtr2] = 100
    sceneGraph.size[sizePtr2 + 1] = 100

    const matPtr2 = rect2Index * 6
    sceneGraph.worldMatrix[matPtr2] = 1
    sceneGraph.worldMatrix[matPtr2 + 3] = 1
    sceneGraph.worldMatrix[matPtr2 + 4] = 50
    sceneGraph.worldMatrix[matPtr2 + 5] = 50

    const aabbPtr2 = rect2Index * 4
    sceneGraph.aabb[aabbPtr2] = 50
    sceneGraph.aabb[aabbPtr2 + 1] = 50
    sceneGraph.aabb[aabbPtr2 + 2] = 150
    sceneGraph.aabb[aabbPtr2 + 3] = 150

    // Click at 75, 75 (Intersection) -> Screen 575, 575
    const result = hitTester.hitTest(575, 575, rootId)
    expect(result).toBe(rect2Index)

    // Click at 25, 25 (Only Rect 1) -> Screen 525, 525
    const result1 = hitTester.hitTest(525, 525, rootId)
    expect(result1).toBe(rect1Index)

    // Click at 125, 125 (Only Rect 2) -> Screen 625, 625
    const result2 = hitTester.hitTest(625, 625, rootId)
    expect(result2).toBe(rect2Index)
  })

  it('should use ray casting for irregular shapes (Polygon)', () => {
    const rootId = 'test:root'
    const rootIndex = sceneGraph.createNode(NodeType.GROUP, rootId)

    // Set Root AABB
    const rootAabbPtr = rootIndex * 4
    sceneGraph.aabb[rootAabbPtr] = 0
    sceneGraph.aabb[rootAabbPtr + 1] = 0
    sceneGraph.aabb[rootAabbPtr + 2] = 1000
    sceneGraph.aabb[rootAabbPtr + 3] = 1000

    const polyId = 'test:poly1'
    const polyIndex = sceneGraph.createNode(NodeType.POLYGON, polyId)
    sceneGraph.appendChild(rootIndex, polyIndex)

    // Triangle: (0,0), (100,0), (50, 100)
    // AABB: 0,0 100,100
    sceneGraph.size[polyIndex * 2] = 100
    sceneGraph.size[polyIndex * 2 + 1] = 100

    // Write Blob Data
    const ptr = sceneGraph.blobs.write({
      points: [0, 0, 100, 0, 50, 100],
    })
    sceneGraph.blobIndexToPtr.set(polyIndex, ptr)

    // World Matrix (Identity, at 0,0)
    const matPtr = polyIndex * 6
    sceneGraph.worldMatrix[matPtr] = 1
    sceneGraph.worldMatrix[matPtr + 3] = 1
    sceneGraph.worldMatrix[matPtr + 4] = 0
    sceneGraph.worldMatrix[matPtr + 5] = 0

    // AABB
    const aabbPtr = polyIndex * 4
    sceneGraph.aabb[aabbPtr] = 0
    sceneGraph.aabb[aabbPtr + 1] = 0
    sceneGraph.aabb[aabbPtr + 2] = 100
    sceneGraph.aabb[aabbPtr + 3] = 100

    // Test Hit Inside Triangle (50, 50)
    // Screen: 50 + 500 = 550
    const resultHit = hitTester.hitTest(550, 550, rootId)
    expect(resultHit).toBe(polyIndex)

    // Test Hit Inside AABB but Outside Triangle (10, 90)
    // Screen: 10 + 500 = 510, 90 + 500 = 590
    // At y=90, triangle width is between x=45 and x=55. Point x=10 is outside.

    const resultMiss = hitTester.hitTest(510, 590, rootId)
    expect(resultMiss).toBe(NULL_INDEX)
  })
})
