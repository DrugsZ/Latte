import { NodeType } from '@latte-js/bean'

import { EllipseNodeEncoder, RectNodeEncoder } from '../nodeEncoders'

import type { INodeCommandEncoder } from '../nodeEncoders'

export const nodeCommandEncoders = new Array<INodeCommandEncoder>(1 << 8)

export function registerNodeCommandEncoder(
  type: NodeType,
  nodeEncoder: INodeCommandEncoder
) {
  nodeCommandEncoders[type] = nodeEncoder
}

export function getNodeCommandEncoder(type: NodeType) {
  return nodeCommandEncoders[type]
}

const builtinNodeCommandEncoders: Array<[NodeType, INodeCommandEncoder]> = [
  [NodeType.RECTANGLE, RectNodeEncoder],
  [NodeType.ELLIPSE, EllipseNodeEncoder],
]

for (const [type, nodeEncoder] of builtinNodeCommandEncoders) {
  registerNodeCommandEncoder(type, nodeEncoder)
}
