import defaultConfig from 'Latte/assets/configuration.json'

export function addToValueTree(
  settingsTreeRoot: any,
  key: string,
  value: any,
  conflictReporter: (message: string) => void
): void {
  const segments = key.split('.')
  const last = segments.pop()!

  let curr = settingsTreeRoot
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    let obj = curr[s]
    switch (typeof obj) {
      case 'undefined':
        curr[s] = Object.create(null)
        obj = curr[s]
        break
      case 'object':
        break
      default:
        conflictReporter(
          `Ignoring ${key} as ${segments
            .slice(0, i + 1)
            .join('.')} is ${JSON.stringify(obj)}`
        )
        return
    }
    curr = obj
  }

  if (typeof curr === 'object' && curr !== null) {
    try {
      curr[last] = value // workaround https://github.com/microsoft/vscode/issues/13606
    } catch (e) {
      conflictReporter(
        `Ignoring ${key} as ${segments.join('.')} is ${JSON.stringify(curr)}`
      )
    }
  } else {
    conflictReporter(
      `Ignoring ${key} as ${segments.join('.')} is ${JSON.stringify(curr)}`
    )
  }
}

export function toValuesTree(
  properties: { [qualifiedKey: string]: any },
  conflictReporter: (message: string) => void
): any {
  const root = Object.create(null)

  // eslint-disable-next-line guard-for-in
  for (const key in properties) {
    addToValueTree(root, key, properties[key], conflictReporter)
  }

  return root
}

function doRemoveFromValueTree(valueTree: any, segments: string[]): void {
  const first = segments.shift()!
  if (segments.length === 0) {
    // Reached last segment
    delete valueTree[first]
    return
  }

  if (Object.keys(valueTree).indexOf(first) !== -1) {
    const value = valueTree[first]
    if (typeof value === 'object' && !Array.isArray(value)) {
      doRemoveFromValueTree(value, segments)
      if (Object.keys(value).length === 0) {
        delete valueTree[first]
      }
    }
  }
}

function getConfigurationValue<T>(
  config: any,
  settingPath: string,
  defaultValue?: T
): T {
  function accessSetting(config: any, path: string[]): any {
    let current = config
    for (const component of path) {
      if (typeof current !== 'object' || current === null) {
        return undefined
      }
      current = current[component]
    }
    return <T>current
  }

  const path = settingPath.split('.')
  const result = accessSetting(config, path)

  return typeof result === 'undefined' ? defaultValue : result
}

export function removeFromValueTree(valueTree: any, key: string): void {
  const segments = key.split('.')
  doRemoveFromValueTree(valueTree, segments)
}

export class ConfigurationModal {
  constructor(
    private readonly _contents: any = {},
    private readonly _keys: string[] = []
  ) {}
  public setValue(key: string, value: any) {
    this._addKey(key)
    addToValueTree(this._contents, key, value, e => {
      throw new Error(e)
    })
  }

  public removeValue(key: string): void {
    if (this._removeKey(key)) {
      removeFromValueTree(this._contents, key)
    }
  }

  private _addKey(key: string): void {
    let index = this._keys.length
    for (let i = 0; i < index; i++) {
      if (key.indexOf(this._keys[i]) === 0) {
        index = i
      }
    }
    this._keys.splice(index, 1, key)
  }

  private _removeKey(key: string): boolean {
    const index = this._keys.indexOf(key)
    if (index !== -1) {
      this._keys.splice(index, 1)
      return true
    }
    return false
  }

  getValue<V>(section: string | undefined): V {
    return section
      ? getConfigurationValue<any>(this._contents, section)
      : this._contents
  }
}

export class DefaultConfigurationModel extends ConfigurationModal {
  constructor() {
    const contents = {}
    const keys = Object.keys(defaultConfig)
    for (const key in defaultConfig) {
      const value = defaultConfig[key]
      addToValueTree(contents, key, value, message =>
        console.error(`Conflict in default settings: ${message}`)
      )
    }
    super(contents, keys)
  }
}
