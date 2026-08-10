import {
  Channels,
  NodeType,
  type CornerRadiusValue,
  type IDType,
  type IPaint,
  type IPropertyService,
  type PropertyKey,
  type PropertyValueMap,
} from '@latte-js/bean'
import {
  MAX_NODES,
  NodeCursor,
  NULL_INDEX,
  PositioningContextResolver,
  type ResolvedPositioningContext,
} from '@latte-js/espresso'
import { mat2d, vec2 } from 'gl-matrix'

import { Service, ServiceBase, type IContext } from './serviceBase'
import { Systems, type TransformSystem } from '../systems'
import {
  MutationPolicyKind,
  type MutationPolicyMap,
} from '../transactions/mutationPolicy'
import { TransactionLabel } from '../transactions/transactionLabels'

interface PropertyTarget {
  readonly id: IDType
  readonly index: number
  readonly type: NodeType
}

type PartialWritePolicy = 'all-required' | 'supported-only'

interface PropertyDescriptor {
  readonly key: PropertyKey
  readonly policy: PartialWritePolicy
  supports(target: PropertyTarget): boolean
  write(target: PropertyTarget, value: unknown): void
}

interface PendingContextTransform {
  readonly target: PropertyTarget
  readonly context: ResolvedPositioningContext
  readonly contextTransform: mat2d
}

const propertyMutationPolicies: MutationPolicyMap = {
  setProperties: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.PropertyLayer,
    ids: args => args[0] as IDType[],
  },
}

const GEOMETRY_TYPES = new Set<NodeType>([
  NodeType.RECTANGLE,
  NodeType.CIRCLE,
  NodeType.ELLIPSE,
  NodeType.POLYGON,
  NodeType.STAR,
  NodeType.LINE,
  NodeType.POLYLINE,
  NodeType.PATH,
  NodeType.TEXT,
  NodeType.FRAME,
  NodeType.GROUP,
])

const RESIZE_TYPES = new Set<NodeType>([
  NodeType.RECTANGLE,
  NodeType.CIRCLE,
  NodeType.ELLIPSE,
  NodeType.POLYGON,
  NodeType.STAR,
  NodeType.LINE,
  NodeType.POLYLINE,
  NodeType.PATH,
  NodeType.FRAME,
  NodeType.GROUP,
])

const PAINT_TYPES = new Set<NodeType>([
  NodeType.RECTANGLE,
  NodeType.CIRCLE,
  NodeType.ELLIPSE,
  NodeType.POLYGON,
  NodeType.STAR,
  NodeType.LINE,
  NodeType.POLYLINE,
  NodeType.PATH,
  NodeType.TEXT,
  NodeType.FRAME,
])

const CORNER_RADIUS_TYPES = new Set<NodeType>([
  NodeType.RECTANGLE,
  NodeType.FRAME,
])

const EPSILON = 1e-6

@Service({ mutations: propertyMutationPolicies })
export class PropertyService extends ServiceBase implements IPropertyService {
  public static readonly name = Channels.Property

  constructor(ctx: IContext) {
    super(ctx)
  }

  public async setProperties(
    ids: IDType[],
    values: PropertyValueMap
  ): Promise<void> {
    const targets = this._resolveTargets(ids)
    const entries = this._resolveEntries(values)
    this._assertSupported(targets, entries)

    this._writeSizes(targets, values)
    this._writeContextTransform(targets, values)

    for (const [key, value] of entries) {
      if (isTransformProperty(key)) {
        continue
      }
      const descriptor = this._getDescriptor(key)
      for (const target of targets) {
        if (descriptor.supports(target)) {
          descriptor.write(target, value)
        }
      }
    }
  }

  private _resolveEntries(values: PropertyValueMap) {
    return (Object.entries(values) as Array<[PropertyKey, unknown]>).filter(
      ([, value]) => value !== undefined
    )
  }

  private _resolveTargets(ids: readonly IDType[]): PropertyTarget[] {
    const targets: PropertyTarget[] = []
    const seen = new Set<IDType>()

    for (const id of ids) {
      if (seen.has(id)) {
        continue
      }
      seen.add(id)
      const index = this.sceneGraph.getIndex(id)
      if (index === NULL_INDEX) {
        throw new Error(`[PropertyService] Node not found: ${id}`)
      }
      targets.push({
        id,
        index,
        type: this.sceneGraph.type[index] as NodeType,
      })
    }

    return targets
  }

  private _assertSupported(
    targets: readonly PropertyTarget[],
    entries: readonly [PropertyKey, unknown][]
  ) {
    for (const [key] of entries) {
      const descriptor = this._getDescriptor(key)
      const unsupported = targets.filter(target => !descriptor.supports(target))
      if (unsupported.length === targets.length) {
        throw new Error(`[PropertyService] ${key} is unavailable`)
      }
      if (unsupported.length > 0 && descriptor.policy === 'all-required') {
        throw new Error(
          `[PropertyService] ${key} is unsupported for ${unsupported
            .map(target => NodeType[target.type])
            .join(', ')}`
        )
      }
    }
  }

  private _writeSizes(
    targets: readonly PropertyTarget[],
    values: PropertyValueMap
  ) {
    if (values.width === undefined && values.height === undefined) {
      return
    }

    const ids = targets
      .filter(target => RESIZE_TYPES.has(target.type))
      .map(target => target.id)
    if (ids.length === 0) {
      return
    }

    this.context.accessSystem
      .getSystem<TransformSystem>(Systems.Transform)
      .setSize(ids, {
        mode: 'absolute-size',
        width: values.width,
        height: values.height,
        anchor: 'local-origin',
      })
  }

  private _writeContextTransform(
    targets: readonly PropertyTarget[],
    values: PropertyValueMap
  ) {
    const writesPosition =
      values.x !== undefined ||
      values.y !== undefined ||
      values.rotation !== undefined
    if (!writesPosition) {
      return
    }

    const localSnapshot = new Map<number, mat2d>()
    const snapshotWorld = new Map<number, mat2d>()
    const finalWorld = new Map<number, mat2d>()
    const pending = new Map<number, PendingContextTransform>()

    for (const target of targets) {
      if (!GEOMETRY_TYPES.has(target.type)) {
        continue
      }

      const context = new PositioningContextResolver(
        this.sceneGraph
      ).resolveByIndex(target.index)
      if (!context) {
        throw new Error(
          `[PropertyService] Cannot resolve positioning context: ${target.id}`
        )
      }

      const nodeWorld = this._computeSnapshotWorldMatrix(
        target.index,
        localSnapshot,
        snapshotWorld
      )
      const containingWorld =
        context.containingParentIndex === NULL_INDEX
          ? mat2d.create()
          : this._computeSnapshotWorldMatrix(
              context.containingParentIndex,
              localSnapshot,
              snapshotWorld
            )
      const containingInv = mat2d.invert(mat2d.create(), containingWorld)
      if (containingInv === null) {
        throw new Error(
          `[PropertyService] Cannot write through a non-invertible containing parent: ${target.id}`
        )
      }

      const contextTransform = mat2d.multiply(
        mat2d.create(),
        containingInv,
        nodeWorld
      )

      if (values.rotation !== undefined) {
        this._setContextRotation(target, contextTransform, values.rotation)
      }

      if (values.x !== undefined) {
        contextTransform[4] = values.x
      }
      if (values.y !== undefined) {
        contextTransform[5] = values.y
      }

      pending.set(target.index, {
        target,
        context,
        contextTransform,
      })
    }

    const writes = Array.from(pending.values()).map(plan => {
      const targetWorld = this._computeFinalWorldMatrix(
        plan.target.index,
        pending,
        localSnapshot,
        finalWorld
      )
      const directParentWorld = this._computeFinalWorldMatrix(
        plan.context.directParentIndex,
        pending,
        localSnapshot,
        finalWorld
      )
      const parentInv = mat2d.invert(mat2d.create(), directParentWorld)
      if (parentInv === null) {
        throw new Error(
          `[PropertyService] Cannot write through a non-invertible parent: ${plan.target.id}`
        )
      }

      const targetLocal = mat2d.multiply(mat2d.create(), parentInv, targetWorld)
      return { index: plan.target.index, targetLocal }
    })

    for (const { index, targetLocal } of writes) {
      const cursor = new NodeCursor(this.sceneGraph, index)
      cursor.transform = targetLocal
    }
  }

  private _setContextRotation(
    target: PropertyTarget,
    contextTransform: mat2d,
    angle: number
  ) {
    if (!Number.isFinite(angle)) {
      throw new Error('[PropertyService] Invalid rotation')
    }
    const currentAngle = Math.atan2(contextTransform[1], contextTransform[0])
    const delta = (angle * Math.PI) / 180 - currentAngle
    if (Math.abs(delta) <= EPSILON) {
      return
    }

    const size = this._readSize(target.index)
    const center = vec2.transformMat2d(
      vec2.create(),
      vec2.fromValues(size.width / 2, size.height / 2),
      contextTransform
    )
    const rotation = mat2d.create()
    mat2d.translate(rotation, rotation, center)
    mat2d.rotate(rotation, rotation, delta)
    mat2d.translate(rotation, rotation, [-center[0], -center[1]])
    mat2d.multiply(contextTransform, rotation, contextTransform)
  }

  private _getDescriptor(key: PropertyKey): PropertyDescriptor {
    switch (key) {
      case 'x':
      case 'y':
      case 'rotation':
        return this._descriptor(key, 'all-required', target =>
          GEOMETRY_TYPES.has(target.type)
        )
      case 'width':
      case 'height':
        return this._descriptor(key, 'all-required', target =>
          RESIZE_TYPES.has(target.type)
        )
      case 'opacity':
        return this._descriptor(
          key,
          'all-required',
          () => true,
          (cursor, v) => {
            cursor.opacity = this._asFiniteNumber(v, 'opacity')
          }
        )
      case 'visible':
        return this._descriptor(
          key,
          'all-required',
          () => true,
          (cursor, v) => {
            cursor.visible = Boolean(v)
          }
        )
      case 'locked':
        return this._descriptor(
          key,
          'all-required',
          () => true,
          (cursor, v) => {
            cursor.locked = Boolean(v)
          }
        )
      case 'fills':
        return this._descriptor(
          key,
          'supported-only',
          target => PAINT_TYPES.has(target.type),
          (cursor, v) => {
            cursor.fills = cloneValue(v as readonly IPaint[]) as IPaint[]
          }
        )
      case 'strokes':
        return this._descriptor(
          key,
          'supported-only',
          target => PAINT_TYPES.has(target.type),
          (cursor, v) => {
            cursor.strokes = cloneValue(v as readonly IPaint[]) as IPaint[]
          }
        )
      case 'strokeWeight':
        return this._descriptor(
          key,
          'supported-only',
          target => PAINT_TYPES.has(target.type),
          (cursor, v) => {
            cursor.strokeWeight = this._asFiniteNumber(v, 'strokeWeight')
          }
        )
      case 'cornerRadius':
        return this._descriptor(
          key,
          'supported-only',
          target => CORNER_RADIUS_TYPES.has(target.type),
          (cursor, v) => {
            cursor.cornerRadius = normalizeCornerRadius(v as CornerRadiusValue)
          }
        )
    }
  }

  private _descriptor(
    key: PropertyKey,
    policy: PartialWritePolicy,
    supports: (target: PropertyTarget) => boolean,
    write?: (cursor: NodeCursor, value: unknown) => void
  ): PropertyDescriptor {
    return {
      key,
      policy,
      supports,
      write: (target, value) => {
        write?.(new NodeCursor(this.sceneGraph, target.index), value)
      },
    }
  }

  private _asFiniteNumber(value: unknown, key: PropertyKey) {
    const number = Number(value)
    if (Number.isFinite(number)) {
      return number
    }
    throw new Error(`[PropertyService] Invalid ${key}`)
  }

  private _readSize(index: number) {
    return {
      width: this.sceneGraph.size[index * 2],
      height: this.sceneGraph.size[index * 2 + 1],
    }
  }

  private _readLocalMatrixSnapshot(
    index: number,
    localSnapshot: Map<number, mat2d>
  ) {
    const cached = localSnapshot.get(index)
    if (cached) {
      return cached
    }

    const cursor = new NodeCursor(this.sceneGraph, index)
    const matrix = mat2d.clone(cursor.transform)
    localSnapshot.set(index, matrix)
    return matrix
  }

  private _computeSnapshotWorldMatrix(
    index: number,
    localSnapshot: Map<number, mat2d>,
    worldSnapshot: Map<number, mat2d>,
    visiting = new Set<number>()
  ): mat2d {
    if (index === NULL_INDEX) {
      return mat2d.create()
    }

    const cached = worldSnapshot.get(index)
    if (cached) {
      return cached
    }
    if (visiting.has(index) || visiting.size > MAX_NODES) {
      throw new Error(`Tree cycle detected at node ${index}`)
    }

    visiting.add(index)
    const parentWorld = this._computeSnapshotWorldMatrix(
      this.sceneGraph.parent[index],
      localSnapshot,
      worldSnapshot,
      visiting
    )
    const world = mat2d.multiply(
      mat2d.create(),
      parentWorld,
      this._readLocalMatrixSnapshot(index, localSnapshot)
    )
    visiting.delete(index)
    worldSnapshot.set(index, world)
    return world
  }

  private _computeFinalWorldMatrix(
    index: number,
    pending: Map<number, PendingContextTransform>,
    localSnapshot: Map<number, mat2d>,
    worldCache: Map<number, mat2d>,
    visiting = new Set<number>()
  ): mat2d {
    if (index === NULL_INDEX) {
      return mat2d.create()
    }

    const cached = worldCache.get(index)
    if (cached) {
      return cached
    }
    if (visiting.has(index) || visiting.size > MAX_NODES) {
      throw new Error(`Tree cycle detected at node ${index}`)
    }

    visiting.add(index)
    const plan = pending.get(index)
    const world = plan
      ? mat2d.multiply(
          mat2d.create(),
          this._computeFinalWorldMatrix(
            plan.context.containingParentIndex,
            pending,
            localSnapshot,
            worldCache,
            visiting
          ),
          plan.contextTransform
        )
      : mat2d.multiply(
          mat2d.create(),
          this._computeFinalWorldMatrix(
            this.sceneGraph.parent[index],
            pending,
            localSnapshot,
            worldCache,
            visiting
          ),
          this._readLocalMatrixSnapshot(index, localSnapshot)
        )
    visiting.delete(index)
    worldCache.set(index, world)
    return world
  }
}

const isTransformProperty = (key: PropertyKey) =>
  key === 'x' ||
  key === 'y' ||
  key === 'rotation' ||
  key === 'width' ||
  key === 'height'

const normalizeCornerRadius = (
  value: CornerRadiusValue
): [number, number, number, number] => {
  if (typeof value === 'number') {
    return [value, value, value, value]
  }
  return [value[0], value[1], value[2], value[3]]
}

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}
