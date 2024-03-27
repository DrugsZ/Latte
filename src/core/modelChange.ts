export enum ChangeEventType {
  DELETE,
  CREATE,
  UPDATE,
}

export class ModelChange {
  constructor(
    public type: ChangeEventType,
    public target: DefaultIDType,
    public oldValue: any,
    public newValue: any
  ) {}
}

export interface ISingleEditOperation {
  readonly id: DefaultIDType

  readonly value: Partial<BaseElementSchema> | null

  readonly type: ChangeEventType
}

export class EditOperation {
  public static update(
    id: DefaultIDType,
    value: Partial<BaseElementSchema>
  ): ISingleEditOperation {
    return {
      type: ChangeEventType.UPDATE,
      id,
      value,
    }
  }

  public static delete(
    id: DefaultIDType,
    value?: Partial<BaseElementSchema>
  ): ISingleEditOperation {
    return {
      type: ChangeEventType.DELETE,
      id,
      value: null,
    }
  }

  public static create<T extends BaseElementSchema>(
    id: DefaultIDType,
    value: T
  ): ISingleEditOperation {
    return {
      type: ChangeEventType.CREATE,
      id,
      value,
    }
  }
}
