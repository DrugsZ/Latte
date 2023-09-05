import { EditorElementTypeKind } from 'Latte/constants/schema'

export enum OperateMode {
  ReadOnly,
  Create,
  Edit,
}

export enum CreateOperate {
  RECTANGLE = EditorElementTypeKind.RECTANGLE,
  ELLIPSE = EditorElementTypeKind.ELLIPSE,
}

export class OperateModeState {
  private _mode: OperateMode = OperateMode.Edit
  private _crateOperateMode: CreateOperate = CreateOperate.RECTANGLE

  setMode(mode: OperateMode) {
    this._mode = mode
  }

  getMode() {
    return this._mode
  }

  setCrateOperateMode(mode: CreateOperate) {
    this._crateOperateMode = mode
    this.setMode(OperateMode.Create)
  }

  getCrateOperateMode() {
    return this._crateOperateMode
  }
}
