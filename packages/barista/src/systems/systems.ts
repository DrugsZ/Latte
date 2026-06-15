import { NodeCursor, type SceneGraph } from '@latte-js/espresso'
import {
  toSceneGraphContext,
  type ISceneGraphContext,
  type SceneGraphContextSource,
} from '../context/sceneGraphContext'
import { SceneGraphMutationWriter } from '../mutations/sceneGraphMutationWriter'
import type { DirtyBatch } from '../pipeline/dirtyBatch'
import type { MutationPolicyMap } from '../transactions/mutationPolicy'

export enum Systems {
  Transform = 'transform',
  Node = 'node',
  Query = 'query',
  Matrix = 'matrix',
  AABB = 'aabb',
}

export enum ScheduleStage {
  Layout = 10,
  Matrix = 20,
  Bounds = 30,
  Projection = 40,
}

export interface ISystemScheduleDescriptor {
  readonly stage: ScheduleStage
  readonly reads: number
  readonly writes?: number
}

export abstract class SystemBase {
  static readonly name: Systems
  static readonly mutationPolicies?: MutationPolicyMap
  static readonly schedule?: ISystemScheduleDescriptor
  private _cursors = new WeakMap<SceneGraph, Map<string, NodeCursor>>()
  protected readonly _context: ISceneGraphContext
  protected readonly _mutationWriter: SceneGraphMutationWriter

  constructor(source: SceneGraphContextSource) {
    this._context = toSceneGraphContext(source)
    this._mutationWriter = new SceneGraphMutationWriter(this._context)
  }

  public getScheduleDescriptor() {
    return (this.constructor as typeof SystemBase).schedule
  }

  protected get _sceneGraph() {
    return this._context.sceneGraph
  }

  protected get _currentSessionId() {
    return this._context.currentSessionId
  }

  protected _getCursor(name: string, initialIndex: number) {
    let cursors = this._cursors.get(this._sceneGraph)
    if (!cursors) {
      cursors = new Map()
      this._cursors.set(this._sceneGraph, cursors)
    }

    let cursor = cursors.get(name)
    if (!cursor) {
      cursor = new NodeCursor(this._sceneGraph, initialIndex)
      cursors.set(name, cursor)
    }

    return cursor
  }

  process?(batch: DirtyBatch): void
}

export type SystemConstructor = (new (
  source: SceneGraphContextSource
) => SystemBase) & {
  readonly name: Systems
  readonly mutationPolicies?: MutationPolicyMap
  readonly schedule?: ISystemScheduleDescriptor
}

export interface ISystemRegistrationOptions {
  readonly mutations?: MutationPolicyMap
  readonly schedule?: ISystemScheduleDescriptor
}

export type AccessSystem = <T extends SystemBase>(name: Systems) => T

const systemRegistry: SystemConstructor[] = []

export function getRegisteredSystems() {
  return systemRegistry
}

function registerSystem(
  ctor: SystemConstructor,
  options?: ISystemRegistrationOptions
) {
  if (options?.mutations) {
    ;(ctor as any).mutationPolicies = options.mutations
  }
  if (options?.schedule) {
    ;(ctor as any).schedule = options.schedule
  }
  systemRegistry.push(ctor)
}

export function System(ctor: SystemConstructor): void
export function System(
  options: ISystemRegistrationOptions
): (ctor: SystemConstructor) => void
export function System(arg: SystemConstructor | ISystemRegistrationOptions) {
  if (typeof arg === 'function') {
    registerSystem(arg)
    return
  }

  return (ctor: SystemConstructor) => {
    registerSystem(ctor, arg)
  }
}

export class BaristaSystem {
  private _systems = new Map<Systems, SystemBase>()
  private readonly _context: ISceneGraphContext

  constructor(source: SceneGraphContextSource) {
    this._context = toSceneGraphContext(source)
    this._init()
  }

  private _init() {
    systemRegistry.forEach(ctor => {
      const instance = new ctor(this._context)
      this._systems.set(ctor.name, instance)
    })
  }

  public registerSystem(ctor: SystemConstructor, system: SystemBase) {
    this._systems.set(ctor.name, system)
  }

  public getSystem<T extends SystemBase>(name: Systems): T {
    return this._systems.get(name) as T
  }

  public getScheduledSystems() {
    return Array.from(this._systems.values())
      .filter(system => !!system.getScheduleDescriptor())
      .sort((a, b) => {
        return (
          a.getScheduleDescriptor()!.stage - b.getScheduleDescriptor()!.stage
        )
      })
  }
}
