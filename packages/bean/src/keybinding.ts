export interface IKeybindings {
  primary?: number
  secondary?: number[]
}

export interface IKeybindingRule extends IKeybindings {
  id: string
  weight: number
  args?: any

  when?: string
}
