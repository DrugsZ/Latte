import { DefaultConfigurationModel } from 'Latte/core/services/configuration/configuration'

export class ConfigurationService {
  private _defaultConfiguration: DefaultConfigurationModel

  constructor() {
    this._defaultConfiguration = new DefaultConfigurationModel()
  }

  getValue(section: string | undefined): any {
    return this._defaultConfiguration.getValue(section)
  }
}
