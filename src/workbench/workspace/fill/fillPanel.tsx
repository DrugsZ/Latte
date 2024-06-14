import type { PropsWithChildren } from 'react'
import { useCallback, useState, useEffect } from 'react'
import type { DisplayObject } from 'Latte/core/displayObject'
import { WorkspacePanel } from 'workbench/workspace/workspacePanel'
import { Row, Col } from 'workbench/components/row'
import { SolidColorPaint } from 'workbench/workspace/fill/solidPaint'

type FillChangeHandler<T extends Paint = SolidColorPaint> = (newFill: T) => void

const DEFAULT_PAINT = `{
          "type": "SOLID",
          "color": {
            "r": 0.8509804010391235,
            "g": 0.8509804010391235,
            "b": 0.8509804010391235,
            "a": 1
          },
          "opacity": 1,
          "visible": true,
          "blendMode": "NORMAL"
        }`

const buttons = [
  {
    icon: (
      <svg className="icon" aria-hidden="true">
        <use xlinkHref="#icon-add"></use>
      </svg>
    ),
    type: 'addFill',
  },
]

interface FillPanelProps {
  paints: Paint[]
  onChange: (newState: Paint[]) => void
}

export const FillPanel = (props: PropsWithChildren<FillPanelProps>) => {
  const { onChange } = props
  const [fills, setFills] = useState<Paint[]>([])

  const handleSelectionChange = useCallback((e: DisplayObject) => {
    const fills = e.getFills()
    setFills(fills)
  }, [])

  const handleFillChange: FillChangeHandler = useCallback(newFill => {
    console.log(newFill)
  }, [])

  const handleAddFill = useCallback(() => {
    setFills(prev => {
      const newFills = [...prev, JSON.parse(DEFAULT_PAINT)]
      onChange?.(newFills)
      return newFills
    })
  }, [onChange])

  useEffect(() => {
    setTimeout(() => {
      const rm = latte.editor.onDidSelectionChange(handleSelectionChange)
    }, 0)
  }, [])

  return (
    <WorkspacePanel
      title="Fill"
      buttons={buttons}
      onButtonClick={handleAddFill}
    >
      {fills.length &&
        fills.map(fill => {
          if (fill.type !== 'SOLID') {
            return
          }
          return (
            <Row style={{ padding: '0 8px' }}>
              <Col
                span={18}
                className="latte-workspace__raw-component__borderFocusWithin"
              >
                <SolidColorPaint data={fill} onChange={handleFillChange} />
              </Col>
            </Row>
          )
        })}
    </WorkspacePanel>
  )
}
