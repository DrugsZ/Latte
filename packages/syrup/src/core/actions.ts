export type Icon = { dark?: URL; light?: URL }

export interface IAction {
  readonly id: string
  label: string
  tooltip: string
  enabled: boolean
  run(event?: unknown): unknown
}

export interface ICommandAction {
  id: string
  title: string
  shortTitle?: string
  category?: string
  tooltip?: string
  icon?: Icon
}

export class Action implements IAction {
  protected _id: string
  protected _label: string
  protected _tooltip: string
  protected _enabled: boolean
  protected _run?: (event?: unknown) => unknown

  constructor(
    id: string,
    label: string,
    tooltip: string,
    enabled: boolean,
    run?: (event?: unknown) => unknown
  ) {
    this._id = id
    this._label = label
    this._tooltip = tooltip
    this._enabled = enabled
    this._run = run
  }

  public get id(): string {
    return this._id
  }

  public get label(): string {
    return this._label
  }

  public get tooltip(): string {
    return this._tooltip
  }

  public get enabled(): boolean {
    return this._enabled
  }

  public run(event?: unknown): unknown {
    if (this._run) {
      return this._run(event)
    }
  }
}

export class Separator implements IAction {
  /**
   * Joins all non-empty lists of actions with separators.
   */
  public static join(...actionLists: readonly IAction[][]) {
    let out: IAction[] = []
    for (const list of actionLists) {
      if (!list.length) {
        // skip
      } else if (out.length) {
        out = [...out, new Separator(), ...list]
      } else {
        out = list
      }
    }

    return out
  }

  static readonly ID = 'latte.actions.separator'

  readonly id: string = Separator.ID

  readonly label: string = ''
  readonly tooltip: string = ''
  readonly class: string = 'separator'
  readonly enabled: boolean = false
  readonly checked: boolean = false
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async run() {}
}
