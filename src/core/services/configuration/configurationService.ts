import { DefaultConfigurationModel } from 'Latte/core/services/configuration/configuration'
import { Disposable } from 'Latte/core/services/lifecycle/lifecycleService'

export class ConfigurationService extends Disposable {
  private _defaultConfiguration: DefaultConfigurationModel

  constructor() {
    super()
    this._defaultConfiguration = new DefaultConfigurationModel()
  }

  getValue(section: string | undefined): any {
    return this._defaultConfiguration.getValue(section)
  }
}
