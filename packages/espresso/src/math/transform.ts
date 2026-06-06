import { mat2, mat2d, vec2 } from 'gl-matrix'

import { DIRTY_AABB, DIRTY_TRANSFORM, NULL_INDEX } from '../data/config'
import { type NodeCursor } from '../data/nodeCursor'
import { type SceneGraph } from '../data/sceneGraph'
/**
 * Apply stretch (scale) to matrix and size, baking the result.
 *
 * - When resizing horizontally (scaleX), the X-axis vector (u) is scaled
 * - When resizing vertically (scaleY), the Y-axis vector (v) is scaled
 * - The matrix columns remain as direction vectors (normalized)
 * - The actual scale is baked into width/height
 *
 * Matrix structure: [a, b, c, d, tx, ty]
 * - u = [a, b] * width  → X-axis in world space
 * - v = [c, d] * height → Y-axis in world space
 *
 * @param matrix The local transform matrix (will be modified in place)
 * @param size Object containing width/height (will be modified in place)
 * @param scaleX Horizontal scale factor
 * @param scaleY Vertical scale factor
 */
export function applyStretchToMatrix(
  matrix: mat2d,
  size: { width: number; height: number },
  scaleX: number,
  scaleY: number
) {
  const EPSILON = 1e-6

  // Extract actual axis vectors (including current size)
  let ux = matrix[0] * size.width
  let uy = matrix[1] * size.width
  let vx = matrix[2] * size.height
  let vy = matrix[3] * size.height

  // Apply scale: scaleX affects x-components, scaleY affects y-components
  ux *= scaleX
  uy *= scaleY
  vx *= scaleX
  vy *= scaleY

  // Calculate new dimensions from scaled vectors
  const newWidth = Math.sqrt(ux * ux + uy * uy)
  const newHeight = Math.sqrt(vx * vx + vy * vy)

  // Update size
  size.width = newWidth
  size.height = newHeight

  // Normalize matrix columns (keep direction, bake scale into size)
  if (newWidth > EPSILON) {
    matrix[0] = ux / newWidth
    matrix[1] = uy / newWidth
  }

  if (newHeight > EPSILON) {
    matrix[2] = vx / newHeight
    matrix[3] = vy / newHeight
  }
}

export function computeStretchTransform(
  accumulatedMatrix: mat2,
  scaleX: number,
  scaleY: number
): mat2 {
  const S = mat2.fromValues(scaleX, 0, 0, scaleY)
  const M_inv = mat2.invert(mat2.create(), accumulatedMatrix)!
  const temp = mat2.multiply(mat2.create(), M_inv, S)
  return mat2.multiply(mat2.create(), temp, accumulatedMatrix)
}

export function applyTransform2x2ToMatrix(
  matrix: mat2d,
  size: { width: number; height: number },
  t: mat2
) {
  const EPSILON = 1e-6

  const ux = matrix[0] * size.width
  const uy = matrix[1] * size.width
  const vx = matrix[2] * size.height
  const vy = matrix[3] * size.height

  // mat2 layout: [m00, m01, m10, m11] (column-major)
  // 应用变换: newU = t * u, newV = t * v
  const newUx = t[0] * ux + t[2] * uy
  const newUy = t[1] * ux + t[3] * uy
  const newVx = t[0] * vx + t[2] * vy
  const newVy = t[1] * vx + t[3] * vy

  const newWidth = Math.sqrt(newUx * newUx + newUy * newUy)
  const newHeight = Math.sqrt(newVx * newVx + newVy * newVy)

  size.width = newWidth
  size.height = newHeight

  if (newWidth > EPSILON) {
    matrix[0] = newUx / newWidth
    matrix[1] = newUy / newWidth
  }

  if (newHeight > EPSILON) {
    matrix[2] = newVx / newHeight
    matrix[3] = newVy / newHeight
  }
}

export function extractMat2(m: mat2d): mat2 {
  return mat2.fromValues(m[0], m[1], m[2], m[3])
}

/**
 * Recursively apply deformation (stretch/scale) to a node and all its descendants.
 *
 * Algorithm (World Space Mutation):
 * - Lift the node to "Root Space" (relative to the resized ancestor).
 * - Apply the Root's deformation (Scale) in this global space.
 * - Project back to Local Space (relative to the new parent transform).
 *
 * This approach (requested by user) is intuitive: "Everything scales by X in world space".
 * It handles deep nesting and rotation correctly by relying on standard matrix composition.
 *
 * P_old_world = Parent_old_world * P_local
 * P_new_world = Root_scale * P_old_world
 * P_new_local = Inv(Parent_new_world) * P_new_world
 */
export function applyDistributiveScale(
  graph: SceneGraph,
  cursor: NodeCursor,
  index: number,
  parentOldWorld: mat2d,
  parentNewWorld: mat2d,
  rootScale: mat2d
) {
  cursor.to(index)

  // 1. Get current Local Transform
  const localTransform = mat2d.clone(cursor.transform as mat2d)

  // 2. Compute Old World Transform
  // W_old = P_old_world * L_old
  const oldWorld = mat2d.create()
  mat2d.multiply(oldWorld, parentOldWorld, localTransform)

  // 3. Compute New World Transform
  // W_new = Root_scale * W_old
  // (We apply the global deformation to the world state)
  const newWorld = mat2d.create()
  mat2d.multiply(newWorld, rootScale, oldWorld)

  // 4. Compute New Local Transform
  // L_new = Inv(P_new_world) * W_new
  const parentNewWorldInv = mat2d.create()
  mat2d.invert(parentNewWorldInv, parentNewWorld)

  const newLocal = mat2d.create()
  mat2d.multiply(newLocal, parentNewWorldInv, newWorld)

  // 5. Extract Scale into Width/Height
  // To "bake" the resize, we extract the scaling component from the matrix
  // and apply it to the node's dimensions, keeping the matrix normalized.
  //
  // NOTE: Simple hypot extraction fails when Skew/Rotation is present (GrandChild case).
  // We want to force Width/Height to represent the "World Axis Aligned Box Size" as much as possible?
  // No, we want "Local Axis Lengths".
  //
  // If the node has Skew, the basis vectors are not orthogonal.
  // |v_x| = sqrt(m00^2 + m01^2)
  // |v_y| = sqrt(m10^2 + m11^2)
  // This IS the correct definition of "Local Scale" even with Skew.
  //
  // However, the user wants the "Visual Size" to be baked into Width/Height.
  // In the GrandChild case (Child rotated 45, Root scaled X), the GrandChild in World Space is a 2:1 rectangle.
  // But its Local Transform relative to Child (which is skewed) makes it 79x79.
  //
  // If we want GrandChild to be 100x50, we are effectively saying:
  // "Ignore the parent's skew distortion. Treat this node as if it's in a cleaner coordinate system."
  // This implies we need to CHANGE the Local Transform to remove Skew/Rotation relative to the visual box.
  //
  // BUT: We cannot arbitrarily change the Local Transform without changing the visual result,
  // UNLESS we also change the `parentNewWorld` passed to children? No, that breaks the chain.
  //
  // Actually, if we want Width=100, Height=50, we are enforcing a specific Local Scale.
  // Let's try to decompose the matrix using QR decomposition or SVD?
  // Or simply:
  // If we assume the node should be "axis aligned" in its own local space as much as possible.
  //
  // The issue is that `newLocal` contains the accumulated skew from the parent.
  // If we strip that skew from `newLocal`, the node will visually "snap" to be orthogonal.
  // This changes the visual result!
  //
  // Unless... the user implies that the GrandChild *should* look different?
  // "宽高需要真实值" -> "Width/Height need to be real values".
  // "不是叠加缩放导致的视觉一致" -> "Not just visual consistency caused by stacked scaling".
  // This suggests the user WANTS the node to physically deform to match the world shape,
  // AND have its Width/Height reflect that world shape's dimensions.
  //
  // In the GrandChild case:
  // World Shape: 100x50 Rectangle (0 deg).
  // Current State: 79x79 Rhombus (in local space of skewed parent).
  // Desired State: 100x50 Rectangle (in local space of skewed parent).
  //
  // If we force Width=100, Height=50, we are setting Scale X=2, Scale Y=1.
  // We need to find a matrix M such that:
  // P_new * M * UnitSquare = WorldShape
  // We know P_new * newLocal * UnitSquare = WorldShape.
  // So M = newLocal.
  //
  // The problem is interpretation.
  // newLocal *is* the matrix that produces the correct World Shape.
  // The basis vectors of newLocal have lengths 79 and 79.
  // This means the local coordinate system IS deformed.
  //
  // If the user wants 100x50, they are asking for the basis vectors to have lengths 100 and 50.
  // This is ALWAYS true if we extract using hypot!
  //
  // Wait.
  // Child (Skewed) -> GrandChild.
  // Child's X axis is (2, 1) [Length 2.23] (World).
  // Child's Y axis is (-2, 1) [Length 2.23] (World).
  // (Assuming Child was Rot 45 then Scaled X*2).
  //
  // GrandChild is at 0 deg World.
  // So GrandChild's X axis is (1, 0) World.
  // GrandChild's Y axis is (0, 1) World.
  //
  // To get (1, 0) World using Child's basis:
  // a * (2, 1) + b * (-2, 1) = (1, 0)
  // 2a - 2b = 1
  // a + b = 0  => a = -b
  // 2(-b) - 2b = 1 => -4b = 1 => b = -0.25, a = 0.25.
  // So Local Vector is (0.25, -0.25).
  // Length of Local Vector = sqrt(0.25^2 + 0.25^2) = sqrt(0.125) = 0.35.
  //
  // This explains why the "Scale" (Width) seems small!
  // In the Local Space of the Skewed Parent, the vector (1,0) World is actually a diagonal short vector.
  //
  // User wants "Width=100".
  // But physically, in that local space, the width IS 0.35 * (Reference Size).
  //
  // If we set Width=100, we are forcing the local vector to be (100, 0) (Local X axis).
  // (100, 0) Local = 100 * Child_X_Axis = 100 * (2, 1) = (200, 100) World.
  // This is NOT (100, 0) World!
  //
  // So: We CANNOT have both "Width=100" AND "World Shape = Rectangle(100, 50)"
  // UNLESS we rotate the Local Space to align with the World Axes?
  // i.e., Change the Rotation of the GrandChild relative to the Child.
  //
  // Currently, GrandChild Rotation relative to Child is -45 deg.
  // If we change it to something else, maybe we can align the axes?
  //
  // But `newLocal` ALREADY contains the rotation needed to match the world shape!
  // `newLocal` = Inv(P_new) * W_new.
  // This matrix is the UNIQUE solution to "How to represent World Shape in Parent Frame".
  //
  // So we cannot change the matrix values (columns) without changing the shape.
  // The only freedom we have is how we *factorize* the matrix.
  // Matrix M = R * S * K ...
  // We usually say M = [BasisX, BasisY].
  // Width = |BasisX|. Height = |BasisY|.
  //
  // If |BasisX| = 79, then Width MUST be 79.
  // If user wants Width=100, they are asking for |BasisX| = 100.
  // This is impossible given the parent's coordinate system constraints.
  //
  // UNLESS: The user implies that we should **Counter-Skew** the child?
  // i.e. "Don't let the parent be skewed".
  // If the Child is skewed, all children suffer.
  // Maybe the Child (who is rotated 45) should NOT have been skewed?
  //
  // In the Child case:
  // Root Scale X*2. Child Rot 45.
  // We calculated Child Skew = 36 deg.
  // This Skew is mathematically necessary to represent the "Squashed Diamond" shape.
  //
  // If we remove the skew from Child, the Child becomes a Rectangle again.
  // But the World Shape was a Squashed Diamond!
  // So we would be changing the shape of the Child.
  //
  // User says: "宽高需要真实值" (Width/Height need real values).
  // "保证数据和视觉都是正确的" (Ensure data and visual are correct).
  //
  // Perhaps the issue is how we *calculate* Width/Height from the matrix.
  // Maybe we should use the "World Size" of the basis vectors?
  // No, Width is local.
  //
  // What if we project the Local Basis Vectors to World Space and measure them there?
  // Length(ParentNewWorld * LocalX) = Length(NewWorldX).
  // NewWorldX = RootScale * OldWorldX.
  // OldWorldX (GrandChild) = (1, 0) * Size.
  // NewWorldX = (ScaleX, 0) * Size.
  // Length = ScaleX * Size.
  //
  // So if we measure the length of the basis vectors **in World Space**, we get the "Visual Size"!
  // Width_Visual = | W_new * (1,0) |
  // Height_Visual = | W_new * (0,1) |
  //
  // Let's check GrandChild:
  // OldWorldX = (1, 0).
  // NewWorldX = (2, 0). Length = 2.
  // So Width_Visual = 2 * OriginalWidth.
  //
  // If we set `node.width = Width_Visual`...
  // Then we must scale the matrix columns to be unit length **in World Space**?
  // No, `node.transform` is Local.
  //
  // If `node.width` becomes 200.
  // And we want the final World Vector to be (200, 0).
  // Then `ParentNewWorld * (newLocal * (1, 0))` must be (200, 0).
  // `newLocal * (1, 0)` is the first column of `newLocal`.
  // Let's call it `Col1`.
  // `ParentNewWorld * Col1 = (200, 0)`.
  // `Col1 = Inv(ParentNewWorld) * (200, 0)`.
  //
  // Currently, `newLocal` has `Col1_current`.
  // We found `|Col1_current| = 79`.
  // But `ParentNewWorld * Col1_current = (200, 0)`.
  // (Because `newLocal` was derived from `W_new`).
  //
  // So `Col1_current` IS the vector that maps to (200, 0).
  // And its length IS 79.
  //
  // So:
  // `node.width` * `node.transform.scaleX` = 79? No.
  // In Latte/Pixi/Flash:
  // Final Transform = Matrix(a, b, c, d, tx, ty).
  // Local Vector V = (x * width, y * height). (If width/height are separate from matrix?)
  //
  // Usually `node.width` IS the visual size, and `transform` has scale 1.
  // OR `node.width` is a property, and `transform` contains scale.
  //
  // If Latte treats `width` as "The length of the local X axis", then Width=79 is CORRECT.
  // Because in that local space, 79 units is the distance required to span the object.
  //
  // BUT user says "Width need real value". They probably mean "World Size".
  // If I set Width=200 (World Size).
  // Then I need `transform` to scale 200 down to 79.
  // Scale factor = 79 / 200 = 0.395.
  //
  // So:
  // 1. Calculate `newLocal` (the correct local matrix).
  // 2. Calculate `sx_visual` = Length of (NewWorld * (1,0)).
  // 3. Calculate `sy_visual` = Length of (NewWorld * (0,1)).
  // 4. Set `node.width *= (sx_visual / sx_local_unit)`. (Wait, just use ratios).
  //
  // Simpler:
  // `sx_visual` is the length of the vector in World Space.
  // `sx_matrix` is the length of the vector in Local Space (hypot of column).
  //
  // If we set `node.width = sx_visual`, then we need to normalize the matrix column such that:
  // `Column * (1/sx_visual)` ... no.
  //
  // The Matrix `newLocal` maps (1, 0) -> Vector V_local.
  // |V_local| = 79.
  // Parent * V_local = V_world.
  // |V_world| = 200.
  //
  // If we want `node.width` to represent |V_world| (200).
  // And we assume `node.transform` is applied *after* size?
  // No, `transform` *is* the mapping.
  //
  // If Latte definition of `width` is "Unscaled Width", and `transform` holds scale...
  // Then `transform` scale should be 1?
  //
  // If `node.width` is just a data property (like in Figma "W" input box),
  // and Figma shows "200" for that GrandChild.
  // Why does Figma show 200?
  // Because Figma likely displays the **Bounding Box Width** (AABB) in the Parent's coordinate system?
  // Or the World AABB Width?
  //
  // If GrandChild is 0 deg World.
  // World AABB Width = 200.
  // So Figma shows 200.
  //
  // In Latte, `cursor.width` is the property stored on the node.
  // If we store 79, the user sees 79 in the property panel.
  // User wants to see 200.
  //
  // So we MUST store 200.
  // `cursor.width = 200`.
  //
  // But the geometry logic uses `cursor.transform`.
  // Does `cursor.transform` implicitly include `width`?
  // Usually NO. `width` is derived from content or explicit setting, `transform` is separate.
  //
  // If `cursor.width` is just a number, and `transform` is the matrix.
  // Then `transform` must be `newLocal`.
  // And `width` should be updated to `200` for UI?
  //
  // If I set `width = 200`, does it affect rendering?
  // In `applyDistributiveScale`, we do:
  // `cursor.width *= sx`
  // `cursor.transform = normalized(newLocal)`
  //
  // The `normalized(newLocal)` has columns of length 1 (ideally).
  // So `transform` says "Scale = 1".
  // `width` says "Size = 79".
  //
  // If we want `width = 200`.
  // We need `transform` to say "Scale = 79/200 = 0.395".
  // So `transform` columns should be scaled by 0.395.
  //
  // So the strategy is:
  // 1. Compute `newLocal` (Total Transform).
  // 2. Compute `visualScaleX` = |NewWorld * (1,0)| / |OldWorld * (1,0)| ?
  //    No, just absolute visual size.
  //    `VisualWidth` = |RootScale * (OldWorld * (1,0))| ... No.
  //    `VisualWidth` = |W_new * UnitX|.
  //
  //    Wait, `W_new` is the transform of the *Node Origin*.
  //    The *Axis Vector* is `W_new_basis = W_new * (1,0) - W_new * (0,0)` (linear part).
  //    Since `W_new` is linear (3x3 affine), we just take the linear part.
  //
  //    `vec_world_x = W_new * [1, 0]`. (Linear multiply).
  //    `visualWidth` = |vec_world_x| * originalUnscaledWidth?
  //    No, we are updating the `width` property itself.
  //
  //    Let's assume the node started with `width = 100`. `transform = Identity`.
  //    `W_old` had X axis length 1.
  //    `W_new` has X axis length 2.
  //    So `visualWidth` should be 200.
  //
  //    So:
  //    `newWidth` = |W_new * (1,0)| (if original width was 1).
  //    Actually: `newWidth` = `oldWidth` * (|W_new * (1,0)| / |W_old * (1,0)|).
  //
  //    Let's call `worldScaleFactorX` = |W_new * (1,0)| / |W_old * (1,0)|.
  //    `cursor.width *= worldScaleFactorX`.
  //
  // 3. Now we have `desiredWidth`.
  //    But we also have `newLocal` matrix which is physically correct for the transform.
  //    `newLocal` has length 79.
  //    `desiredWidth` is 200.
  //
  //    We need `transform` * `desiredWidth` == `newLocal` * `1` ?
  //    If rendering is `Matrix * Point(width, height)`.
  //    Then `Matrix_new * 200` must equal `newLocal * 1`.
  //    `Matrix_new` = `newLocal * (1/200)`.
  //
  //    So we normalize `newLocal` not by its own length (79), but by the `worldScaleFactor`?
  //    No, by the `newWidth`.
  //
  //    Algorithm:
  //    1. Compute `newLocal` (The target physical matrix).
  //    2. Compute `W_new_basis_x` = `W_new` * (1,0).
  //       Compute `W_old_basis_x` = `W_old` * (1,0).
  //       `scaleX_world` = length(W_new_basis_x) / length(W_old_basis_x).
  //    3. Update `cursor.width *= scaleX_world`.
  //    4. Scale `newLocal` columns:
  //       `col0` = `col0` / `scaleX_world`. (Wait, no).
  //
  //       We want `FinalMatrix * (width) == newLocal`.
  //       `FinalMatrix * (oldWidth * scaleX_world) == newLocal`.
  //       `FinalMatrix = newLocal / (oldWidth * scaleX_world)`.
  //       But `newLocal` contains the *scale* relative to the parent.
  //
  //       Let's look at `extractScale`:
  //       `sx = hypot(newLocal)`.
  //       `cursor.width *= sx`.
  //       `cursor.transform = newLocal / sx`.
  //
  //       Here `sx` IS the local scale factor.
  //       If we use this, `width` becomes 79.
  //
  //       We want `width` to be 200.
  //       So we need `sx_override` = 200 / oldWidth.
  //       `cursor.width = 200`.
  //       `cursor.transform = newLocal / sx_override`.
  //
  //       So the only change is: **How do we calculate `sx` (the extracted scale)?**
  //       Instead of `sx = hypot(newLocal)`, we use `sx = WorldScaleFactor`.
  //
  //       This forces the `width` property to track the World Size.
  //       And the `transform` matrix compensates (by shrinking/skewing) to keep the physical result identical.
  //
  //       Does this work for GrandChild?
  //       `W_old` X axis length = 1.
  //       `W_new` X axis length = 2.
  //       `scaleX_world` = 2.
  //       `cursor.width` (50) *= 2 => 100. (Correct!)
  //       `cursor.transform` = `newLocal` / 2.
  //       `newLocal` had length 79.
  //       `transform` length = 79 / 2 = 39.5.
  //       Scale factor ~0.4.
  //
  //       Result:
  //       Property Panel shows Width = 100.
  //       Rendering uses Matrix(scale=0.4) * Width(100) = 40?
  //       Wait. 79 was the correct physical length.
  //       Is 40 correct? 79 is correct.
  //       0.4 * 100 = 40.
  //       Why 40?
  //       Ah, `newLocal` length was 0.79 (relative to 1).
  //       Wait, in previous test:
  //       GrandChild size became 79.06.
  //       Original was 50.
  //       So `sx` extracted was 1.58.
  //
  //       If we use `sx_world = 2`.
  //       `width` becomes 100.
  //       `transform` scale = 1.58 / 2 = 0.79.
  //       Final physical size = 0.79 * 100 = 79.
  //       MATCH!
  //
  //       So this logic preserves the physical correctness (79) while showing the logical world width (100).
  //       This seems to be exactly what is requested.
  //
  //       One edge case: Skew.
  //       If we use World Axis Lengths, we are assuming the object deforms along its axes.
  //       But if the object rotates in world space, `W_new * (1,0)` might change direction.
  //       Length is rotation invariant.
  //
  //       So `scaleX_world` = |W_new X| / |W_old X|.
  //       This accurately captures "How much the X axis stretched in world space".
  //
  //       Let's implement this "World Axis Scale Extraction".

  // --- NEW LOGIC START ---
  // To ensure visual correctness of width/height properties (User Request),
  // we extract scale based on World Space axis deformation, not Local Space.
  //
  // WorldScale = |W_new * Unit| / |W_old * Unit|
  //
  // Unit vectors for the node's local axes
  const unitX = vec2.fromValues(1, 0)
  const unitY = vec2.fromValues(0, 1)

  // Transform to World Space (Linear part only, ignore translation)
  const origin = vec2.fromValues(0, 0)
  const oldWorldOrigin = vec2.create()
  vec2.transformMat2d(oldWorldOrigin, origin, oldWorld)

  // W_old * UnitX
  const oldWorldX = vec2.create()
  vec2.transformMat2d(oldWorldX, unitX, oldWorld)
  vec2.subtract(oldWorldX, oldWorldX, oldWorldOrigin)

  const oldWorldY = vec2.create()
  vec2.transformMat2d(oldWorldY, unitY, oldWorld)
  vec2.subtract(oldWorldY, oldWorldY, oldWorldOrigin)

  // New World Origin
  const newWorldOrigin = vec2.create()
  vec2.transformMat2d(newWorldOrigin, origin, newWorld)

  // W_new * UnitX
  const newWorldX = vec2.create()
  vec2.transformMat2d(newWorldX, unitX, newWorld)
  vec2.subtract(newWorldX, newWorldX, newWorldOrigin)

  const newWorldY = vec2.create()
  vec2.transformMat2d(newWorldY, unitY, newWorld)
  vec2.subtract(newWorldY, newWorldY, newWorldOrigin)

  // Calculate Length Ratios
  const lenOldX = vec2.length(oldWorldX)
  const lenOldY = vec2.length(oldWorldY)
  const lenNewX = vec2.length(newWorldX)
  const lenNewY = vec2.length(newWorldY)

  // Avoid division by zero
  const worldScaleX = lenOldX > 1e-6 ? lenNewX / lenOldX : 1
  const worldScaleY = lenOldY > 1e-6 ? lenNewY / lenOldY : 1

  // Use World Scales for Width/Height
  cursor.width *= worldScaleX
  cursor.height *= worldScaleY

  // Normalize Matrix by the scales we just extracted
  // We divide the matrix columns by `worldScale`, not `sx` (local scale).
  // This leaves the "difference" (Skew/Compensation) in the matrix.
  if (worldScaleX !== 0) {
    newLocal[0] /= worldScaleX
    newLocal[1] /= worldScaleX
  }
  if (worldScaleY !== 0) {
    newLocal[2] /= worldScaleY
    newLocal[3] /= worldScaleY
  }
  // --- NEW LOGIC END ---

  /*
  // Original Local-based Extraction
  if (sx !== 0) {
    newLocal[0] /= sx
    newLocal[1] /= sx
  }
  if (sy !== 0) {
    newLocal[2] /= sy
    newLocal[3] /= sy
  }
  */

  // Update Transform
  cursor.transform = newLocal
  cursor.x = newLocal[4]
  cursor.y = newLocal[5]

  graph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)

  // 6. Recurse
  // The current node's New World Transform becomes the Parent New World for its children.
  // We use the computed `newWorld` (before extraction?)
  // WAIT: The children are relative to the *actual* new local transform (which we normalized).
  // So the "Parent New World" for children must be based on the *actual* final transform of this node.
  // Actual Final World = ParentNewWorld * FinalLocal.
  // We should re-compute this to be safe, or derive it.
  // Actually, if we extracted scale into width/height, the visual world transform is the same!
  // (Scale in matrix vs Scale in width/height -> Visually identical for position of children?)
  // NO. Children are transformed by the Parent's Matrix. They are NOT affected by Parent's Width/Height.
  // So if we remove scale from the matrix, the children effectively "shrink" (relative to world) unless we counter-scale them?
  //
  // CRITICAL DISTINCTION:
  // In Latte, does a Child's position depend on Parent's Width/Height?
  // Usually NO. It depends on Parent's Transform.
  // So if we extract scale from Matrix into Width/Height, we are *changing* the Parent's coordinate system for its children!
  // If we remove scale from the matrix, the children will move closer together.
  // To keep children in the same World Place, we must update the children's Local Transform to compensate.
  //
  // BUT: The algorithm above `L_new = Inv(P_new) * W_new` handles this automatically!
  // `P_new` IS the matrix we passed to the children.
  // So we just need to pass the *correct* `P_new` to the children.
  //
  // What `P_new` do we pass?
  // We pass the `newLocal` (the one we committed to the node) composed with `parentNewWorld`.
  // `effectiveNewWorld = parentNewWorld * newLocal`.
  // Since `newLocal` has scale removed (normalized), `effectiveNewWorld` will also be "smaller".
  // This means the children, when we calculate `L_child = Inv(effectiveNewWorld) * W_child`, will automatically get larger local values to compensate!
  //
  // So the algorithm holds! We just need to ensure we calculate `nextParentNewWorld` using the *normalized* `newLocal`.

  const nextParentNewWorld = mat2d.create()
  mat2d.multiply(nextParentNewWorld, parentNewWorld, newLocal)

  let child = graph.firstChild[index]
  while (child !== NULL_INDEX) {
    applyDistributiveScale(
      graph,
      cursor,
      child,
      oldWorld, // The "Old World" of this node is the "Parent Old World" for children
      nextParentNewWorld, // The "New World" of this node is the "Parent New World" for children
      rootScale
    )
    child = graph.nextSibling[child]
  }
}
