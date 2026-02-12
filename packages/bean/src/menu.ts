export enum MenuId {
  Layer = 'Layer',
  Toolbar = 'Toolbar',
  EditorContext = 'EditorContext',
}

export interface IMenuItem {
  command: string
  label?: string
  group?: string
  when?: string
}

export interface IMenuModel {
  items: IMenuItem[]
  anchor: { x: number; y: number }
}
