import { IBaseElementSchema, IDType } from './nodes'

interface LatteFile {
  type: 'NODE_CHANGES'
  elements: IBaseElementSchema[]
  sessionID: number
  guid: IDType
}
