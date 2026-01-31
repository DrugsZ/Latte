import { mat2, mat2d, vec2 } from 'gl-matrix'
import {
  computeStretchTransform,
  extractMat2,
} from '@latte-js/espresso'

function rotationMat2d(degrees: number): mat2d {
  const rad = (degrees * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return mat2d.fromValues(c, s, -s, c, 0, 0)
}

interface Node {
  name: string
  x: number
  y: number
  width: number
  height: number
  transform: mat2d
}

/**
 * Algorithm A: Accumulated Matrix Approach (Keep Rotation)
 * - Position uses parent's accumulated matrix for transform
 * - Size uses node's own accumulated matrix for scale factors
 * - Transform (rotation) remains unchanged
 */
function applyStretchAlgorithmA(
  node: Node,
  scaleX: number,
  scaleY: number,
  parentAccumulatedMatrix: mat2
): { node: Node; nodeAccumulatedMatrix: mat2 } {
  // Get node's local rotation
  const nodeLocalMatrix = extractMat2(node.transform)
  
  // Node's accumulated matrix = parentAccumulated * nodeLocal
  const nodeAccumulatedMatrix = mat2.multiply(
    mat2.create(),
    parentAccumulatedMatrix,
    nodeLocalMatrix
  )

  // Position transform uses parent's accumulated matrix
  const positionTransform = computeStretchTransform(parentAccumulatedMatrix, scaleX, scaleY)
  const newX = positionTransform[0] * node.x + positionTransform[2] * node.y
  const newY = positionTransform[1] * node.x + positionTransform[3] * node.y

  // Size transform uses node's own accumulated matrix
  const sizeTransform = computeStretchTransform(nodeAccumulatedMatrix, scaleX, scaleY)
  
  // Extract scale factors (no shear applied to transform)
  const widthScale = Math.sqrt(
    sizeTransform[0] * sizeTransform[0] + sizeTransform[1] * sizeTransform[1]
  )
  const heightScale = Math.sqrt(
    sizeTransform[2] * sizeTransform[2] + sizeTransform[3] * sizeTransform[3]
  )

  return {
    node: {
      name: node.name,
      x: newX,
      y: newY,
      width: node.width * widthScale,
      height: node.height * heightScale,
      transform: mat2d.clone(node.transform), // Keep original rotation!
    },
    nodeAccumulatedMatrix,
  }
}

console.log('='.repeat(80))
console.log('ALGORITHM A: ACCUMULATED MATRIX APPROACH')
console.log('='.repeat(80))

// ============================================================================
// SCENARIO 1: Root(45°) -> A(0°, at 100,0) -> B(0°, at 50,0)
// ============================================================================
console.log('\n' + '─'.repeat(80))
console.log('SCENARIO 1: Root(45°) → A(at 100,0) → B(at 50,0)')
console.log('Stretch: scaleX=2, scaleY=1')
console.log('─'.repeat(80))

{
  const nodeA: Node = { name: 'A', x: 100, y: 0, width: 100, height: 50, transform: mat2d.create() }
  const nodeB: Node = { name: 'B', x: 50, y: 0, width: 40, height: 20, transform: mat2d.create() }

  const scaleX = 2, scaleY = 1
  const identity = mat2.create()

  // A: parentAccumulated = Identity
  const { node: newA, nodeAccumulatedMatrix: aAccum } = applyStretchAlgorithmA(nodeA, scaleX, scaleY, identity)
  // B: parentAccumulated = A's accumulated
  const { node: newB } = applyStretchAlgorithmA(nodeB, scaleX, scaleY, aAccum)

  console.log('\n=== RESULTS ===')
  console.log(`A: (${newA.x.toFixed(2)}, ${newA.y.toFixed(2)}), size=${newA.width.toFixed(2)}x${newA.height.toFixed(2)}`)
  console.log(`B: (${newB.x.toFixed(2)}, ${newB.y.toFixed(2)}), size=${newB.width.toFixed(2)}x${newB.height.toFixed(2)}`)

  const newAMat = extractMat2(newA.transform)
  const bInRoot = vec2.fromValues(
    newA.x + newAMat[0] * newB.x + newAMat[2] * newB.y,
    newA.y + newAMat[1] * newB.x + newAMat[3] * newB.y
  )
  console.log(`B in Root: (${bInRoot[0].toFixed(2)}, ${bInRoot[1].toFixed(2)})`)

  const expectedA = vec2.fromValues(200, 0)
  const expectedBInRoot = vec2.fromValues(300, 0)
  const aError = vec2.distance(vec2.fromValues(newA.x, newA.y), expectedA)
  const bError = vec2.distance(bInRoot, expectedBInRoot)

  console.log('\n=== VERIFICATION ===')
  console.log(`A error: ${aError.toFixed(6)} ${aError < 0.01 ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`B in Root error: ${bError.toFixed(6)} ${bError < 0.01 ? '✓ PASS' : '✗ FAIL'}`)
}

// ============================================================================
// SCENARIO 2: Root(0°) -> A(90°, at 100,0) -> B(0°, at 50,0)
// ============================================================================
console.log('\n' + '─'.repeat(80))
console.log('SCENARIO 2: Root(0°) → A(90°, at 100,0) → B(at 50,0)')
console.log('Stretch: scaleX=2, scaleY=1')
console.log('─'.repeat(80))

{
  const nodeA: Node = { name: 'A', x: 100, y: 0, width: 100, height: 50, transform: rotationMat2d(90) }
  const nodeB: Node = { name: 'B', x: 50, y: 0, width: 40, height: 20, transform: mat2d.create() }

  const scaleX = 2, scaleY = 1
  const identity = mat2.create()

  const { node: newA, nodeAccumulatedMatrix: aAccum } = applyStretchAlgorithmA(nodeA, scaleX, scaleY, identity)
  const { node: newB } = applyStretchAlgorithmA(nodeB, scaleX, scaleY, aAccum)

  console.log('\n=== RESULTS ===')
  console.log(`A: (${newA.x.toFixed(2)}, ${newA.y.toFixed(2)}), size=${newA.width.toFixed(2)}x${newA.height.toFixed(2)}`)
  console.log(`B: (${newB.x.toFixed(2)}, ${newB.y.toFixed(2)}), size=${newB.width.toFixed(2)}x${newB.height.toFixed(2)}`)

  const newAMat = extractMat2(newA.transform)
  const bInRoot = vec2.fromValues(
    newA.x + newAMat[0] * newB.x + newAMat[2] * newB.y,
    newA.y + newAMat[1] * newB.x + newAMat[3] * newB.y
  )
  console.log(`B in Root: (${bInRoot[0].toFixed(2)}, ${bInRoot[1].toFixed(2)})`)

  // Expected: A at (200, 0), B in Root at (200, 50)
  const expectedBInRoot = vec2.fromValues(200, 50)
  const bError = vec2.distance(bInRoot, expectedBInRoot)

  console.log('\n=== VERIFICATION ===')
  console.log(`B in Root error: ${bError.toFixed(6)} ${bError < 0.01 ? '✓ PASS' : '✗ FAIL'}`)
}

// ============================================================================
// SCENARIO 3: DEEP HIERARCHY - Root(30°) → A(45°) → B(-15°) → C(0°)
// ============================================================================
console.log('\n' + '─'.repeat(80))
console.log('SCENARIO 3: DEEP - Root(30°) → A(45°, at 100,50) → B(-15°, at 40,20) → C(0°, at 25,10)')
console.log('Stretch: scaleX=1.5, scaleY=0.8')
console.log('─'.repeat(80))

{
  const nodeA: Node = { name: 'A', x: 100, y: 50, width: 80, height: 40, transform: rotationMat2d(45) }
  const nodeB: Node = { name: 'B', x: 40, y: 20, width: 60, height: 30, transform: rotationMat2d(-15) }
  const nodeC: Node = { name: 'C', x: 25, y: 10, width: 20, height: 15, transform: mat2d.create() }

  const scaleX = 1.5, scaleY = 0.8
  const identity = mat2.create()

  // Calculate original world positions
  const aMat = extractMat2(nodeA.transform)
  const bMat = extractMat2(nodeB.transform)
  const abMat = mat2.multiply(mat2.create(), aMat, bMat)

  const origAInRoot = vec2.fromValues(nodeA.x, nodeA.y)
  const origBInRoot = vec2.fromValues(
    nodeA.x + aMat[0] * nodeB.x + aMat[2] * nodeB.y,
    nodeA.y + aMat[1] * nodeB.x + aMat[3] * nodeB.y
  )
  const origCInRoot = vec2.fromValues(
    origBInRoot[0] + abMat[0] * nodeC.x + abMat[2] * nodeC.y,
    origBInRoot[1] + abMat[1] * nodeC.x + abMat[3] * nodeC.y
  )

  console.log('\n=== ORIGINAL POSITIONS (in Root coords) ===')
  console.log(`A: (${origAInRoot[0].toFixed(2)}, ${origAInRoot[1].toFixed(2)})`)
  console.log(`B: (${origBInRoot[0].toFixed(2)}, ${origBInRoot[1].toFixed(2)})`)
  console.log(`C: (${origCInRoot[0].toFixed(2)}, ${origCInRoot[1].toFixed(2)})`)

  // Expected: scale original positions
  const expectedA = vec2.fromValues(origAInRoot[0] * scaleX, origAInRoot[1] * scaleY)
  const expectedB = vec2.fromValues(origBInRoot[0] * scaleX, origBInRoot[1] * scaleY)
  const expectedC = vec2.fromValues(origCInRoot[0] * scaleX, origCInRoot[1] * scaleY)

  console.log('\n=== EXPECTED POSITIONS (in Root coords) ===')
  console.log(`A: (${expectedA[0].toFixed(2)}, ${expectedA[1].toFixed(2)})`)
  console.log(`B: (${expectedB[0].toFixed(2)}, ${expectedB[1].toFixed(2)})`)
  console.log(`C: (${expectedC[0].toFixed(2)}, ${expectedC[1].toFixed(2)})`)

  // Apply Algorithm A
  const { node: newA, nodeAccumulatedMatrix: aAccum } = applyStretchAlgorithmA(nodeA, scaleX, scaleY, identity)
  const { node: newB, nodeAccumulatedMatrix: bAccum } = applyStretchAlgorithmA(nodeB, scaleX, scaleY, aAccum)
  const { node: newC } = applyStretchAlgorithmA(nodeC, scaleX, scaleY, bAccum)

  console.log('\n=== NEW LOCAL POSITIONS ===')
  console.log(`A: (${newA.x.toFixed(2)}, ${newA.y.toFixed(2)})`)
  console.log(`B: (${newB.x.toFixed(2)}, ${newB.y.toFixed(2)})`)
  console.log(`C: (${newC.x.toFixed(2)}, ${newC.y.toFixed(2)})`)

  // Calculate new world positions
  const newAMat = extractMat2(newA.transform)
  const newBMat = extractMat2(newB.transform)
  const newABMat = mat2.multiply(mat2.create(), newAMat, newBMat)

  const newAInRoot = vec2.fromValues(newA.x, newA.y)
  const newBInRoot = vec2.fromValues(
    newA.x + newAMat[0] * newB.x + newAMat[2] * newB.y,
    newA.y + newAMat[1] * newB.x + newAMat[3] * newB.y
  )
  const newCInRoot = vec2.fromValues(
    newBInRoot[0] + newABMat[0] * newC.x + newABMat[2] * newC.y,
    newBInRoot[1] + newABMat[1] * newC.x + newABMat[3] * newC.y
  )

  console.log('\n=== ACTUAL POSITIONS (in Root coords) ===')
  console.log(`A: (${newAInRoot[0].toFixed(2)}, ${newAInRoot[1].toFixed(2)})`)
  console.log(`B: (${newBInRoot[0].toFixed(2)}, ${newBInRoot[1].toFixed(2)})`)
  console.log(`C: (${newCInRoot[0].toFixed(2)}, ${newCInRoot[1].toFixed(2)})`)

  const aError = vec2.distance(newAInRoot, expectedA)
  const bError = vec2.distance(newBInRoot, expectedB)
  const cError = vec2.distance(newCInRoot, expectedC)

  console.log('\n=== VERIFICATION ===')
  console.log(`A error: ${aError.toFixed(6)} ${aError < 0.01 ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`B error: ${bError.toFixed(6)} ${bError < 0.01 ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`C error: ${cError.toFixed(6)} ${cError < 0.01 ? '✓ PASS' : '✗ FAIL'}`)
}

// ============================================================================
// SCENARIO 4: 4-LEVEL DEEP - Root → A → B → C → D
// ============================================================================
console.log('\n' + '─'.repeat(80))
console.log('SCENARIO 4: 4-LEVEL - Root → A(30°) → B(60°) → C(-45°) → D(15°)')
console.log('Stretch: scaleX=2, scaleY=0.5')
console.log('─'.repeat(80))

{
  const nodeA: Node = { name: 'A', x: 50, y: 30, width: 40, height: 20, transform: rotationMat2d(30) }
  const nodeB: Node = { name: 'B', x: 30, y: 15, width: 30, height: 15, transform: rotationMat2d(60) }
  const nodeC: Node = { name: 'C', x: 20, y: 10, width: 25, height: 12, transform: rotationMat2d(-45) }
  const nodeD: Node = { name: 'D', x: 15, y: 8, width: 18, height: 9, transform: rotationMat2d(15) }

  const scaleX = 2, scaleY = 0.5
  const identity = mat2.create()

  // Calculate original world positions
  const aMat = extractMat2(nodeA.transform)
  const bMat = extractMat2(nodeB.transform)
  const cMat = extractMat2(nodeC.transform)
  const abMat = mat2.multiply(mat2.create(), aMat, bMat)
  const abcMat = mat2.multiply(mat2.create(), abMat, cMat)

  const origAInRoot = vec2.fromValues(nodeA.x, nodeA.y)
  const origBInRoot = vec2.fromValues(
    nodeA.x + aMat[0] * nodeB.x + aMat[2] * nodeB.y,
    nodeA.y + aMat[1] * nodeB.x + aMat[3] * nodeB.y
  )
  const origCInRoot = vec2.fromValues(
    origBInRoot[0] + abMat[0] * nodeC.x + abMat[2] * nodeC.y,
    origBInRoot[1] + abMat[1] * nodeC.x + abMat[3] * nodeC.y
  )
  const origDInRoot = vec2.fromValues(
    origCInRoot[0] + abcMat[0] * nodeD.x + abcMat[2] * nodeD.y,
    origCInRoot[1] + abcMat[1] * nodeD.x + abcMat[3] * nodeD.y
  )

  // Expected: scale original positions
  const expectedA = vec2.fromValues(origAInRoot[0] * scaleX, origAInRoot[1] * scaleY)
  const expectedB = vec2.fromValues(origBInRoot[0] * scaleX, origBInRoot[1] * scaleY)
  const expectedC = vec2.fromValues(origCInRoot[0] * scaleX, origCInRoot[1] * scaleY)
  const expectedD = vec2.fromValues(origDInRoot[0] * scaleX, origDInRoot[1] * scaleY)

  // Apply Algorithm A
  const { node: newA, nodeAccumulatedMatrix: aAccum } = applyStretchAlgorithmA(nodeA, scaleX, scaleY, identity)
  const { node: newB, nodeAccumulatedMatrix: bAccum } = applyStretchAlgorithmA(nodeB, scaleX, scaleY, aAccum)
  const { node: newC, nodeAccumulatedMatrix: cAccum } = applyStretchAlgorithmA(nodeC, scaleX, scaleY, bAccum)
  const { node: newD } = applyStretchAlgorithmA(nodeD, scaleX, scaleY, cAccum)

  // Calculate new world positions
  const newAMat = extractMat2(newA.transform)
  const newBMat = extractMat2(newB.transform)
  const newCMat = extractMat2(newC.transform)
  const newABMat = mat2.multiply(mat2.create(), newAMat, newBMat)
  const newABCMat = mat2.multiply(mat2.create(), newABMat, newCMat)

  const newAInRoot = vec2.fromValues(newA.x, newA.y)
  const newBInRoot = vec2.fromValues(
    newA.x + newAMat[0] * newB.x + newAMat[2] * newB.y,
    newA.y + newAMat[1] * newB.x + newAMat[3] * newB.y
  )
  const newCInRoot = vec2.fromValues(
    newBInRoot[0] + newABMat[0] * newC.x + newABMat[2] * newC.y,
    newBInRoot[1] + newABMat[1] * newC.x + newABMat[3] * newC.y
  )
  const newDInRoot = vec2.fromValues(
    newCInRoot[0] + newABCMat[0] * newD.x + newABCMat[2] * newD.y,
    newCInRoot[1] + newABCMat[1] * newD.x + newABCMat[3] * newD.y
  )

  console.log('\n=== EXPECTED vs ACTUAL ===')
  console.log(`A: expected (${expectedA[0].toFixed(2)}, ${expectedA[1].toFixed(2)}), actual (${newAInRoot[0].toFixed(2)}, ${newAInRoot[1].toFixed(2)})`)
  console.log(`B: expected (${expectedB[0].toFixed(2)}, ${expectedB[1].toFixed(2)}), actual (${newBInRoot[0].toFixed(2)}, ${newBInRoot[1].toFixed(2)})`)
  console.log(`C: expected (${expectedC[0].toFixed(2)}, ${expectedC[1].toFixed(2)}), actual (${newCInRoot[0].toFixed(2)}, ${newCInRoot[1].toFixed(2)})`)
  console.log(`D: expected (${expectedD[0].toFixed(2)}, ${expectedD[1].toFixed(2)}), actual (${newDInRoot[0].toFixed(2)}, ${newDInRoot[1].toFixed(2)})`)

  const aError = vec2.distance(newAInRoot, expectedA)
  const bError = vec2.distance(newBInRoot, expectedB)
  const cError = vec2.distance(newCInRoot, expectedC)
  const dError = vec2.distance(newDInRoot, expectedD)

  console.log('\n=== VERIFICATION ===')
  console.log(`A error: ${aError.toFixed(6)} ${aError < 0.01 ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`B error: ${bError.toFixed(6)} ${bError < 0.01 ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`C error: ${cError.toFixed(6)} ${cError < 0.01 ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`D error: ${dError.toFixed(6)} ${dError < 0.01 ? '✓ PASS' : '✗ FAIL'}`)
}

console.log('\n' + '='.repeat(80))
console.log('ALGORITHM A TEST COMPLETE')
console.log('='.repeat(80))
