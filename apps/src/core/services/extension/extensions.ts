export interface IMenu {
  command: string
  alt?: string
  when?: string
  group?: string
}

export interface ICommand {
  command: string
  title: string
}

export interface IConfigurationProperty {
  description: string
  type: string | string[]
  default?: any
}

export interface IConfiguration {
  id?: string
  order?: number
  title?: string
  properties: { [key: string]: IConfigurationProperty }
}

export interface IKeyBinding {
  command: string
  key: string
  when?: string
  mac?: string
  linux?: string
  win?: string
}

export interface IExtensionContributions {
  commands?: ICommand[]
  menu?: { [context: string]: IMenu[] }
  configuration?: IConfiguration | IConfiguration[]
  keybindings?: IKeyBinding[]
}
