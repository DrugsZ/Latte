import type { PropsWithChildren } from 'react'
import { useCallback, useState, useEffect } from 'react'
import type { DisplayObject } from 'Latte/core/displayObject'
import type { WorkspacePanelIconButton } from 'workbench/workspace/workspacePanel'
import {
  WorkspacePanel,
  PaintCommonButtons,
} from 'workbench/workspace/workspacePanel'
import { Row, Col } from 'workbench/components/row'
import { SolidColorPaint } from 'workbench/workspace/fill/solidPaint'

type FillChangeHandler<T extends Paint = SolidColorPaint> = (
  index: number,
  newFill: T
) => void

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

enum PaintCommonButtonsType {
  Visible = 'visible',
  Hide = 'hide',
  Delete = 'delete',
}

const titleButtons: WorkspacePanelIconButton[] = [
  {
    icon: (
      <svg className="icon" aria-hidden="true">
        <use xlinkHref="#icon-add"></use>
      </svg>
    ),
    type: 'addFill',
  },
]

const deleteIcon = {
  icon: (
    <svg className="icon" aria-hidden="true">
      <use xlinkHref="#icon-hr"></use>
    </svg>
  ),
  type: PaintCommonButtonsType.Delete,
}

const paintCommonVisibleButtons: WorkspacePanelIconButton[] = [
  {
    icon: (
      <svg className="icon" aria-hidden="true">
        <use xlinkHref="#icon-eye"></use>
      </svg>
    ),
    type: PaintCommonButtonsType.Hide,
  },
  deleteIcon,
]

const paintCommonHideButtons: WorkspacePanelIconButton[] = [
  {
    icon: (
      <svg className="icon" aria-hidden="true">
        <use xlinkHref="#icon-eye1"></use>
      </svg>
    ),
    type: PaintCommonButtonsType.Visible,
  },
  deleteIcon,
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

  const handleFillChange: FillChangeHandler = useCallback(
    (index, newFill) => {
      setFills(prev => {
        prev[index] = newFill
        onChange?.(prev)
        return [...prev]
      })
    },
    [onChange]
  )

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

  const handleCommonButtonClick = useCallback(
    (index: number, type: PaintCommonButtonsType) => {
      setFills(prev => {
        const currFill = prev[index]
        if (!currFill) {
          return prev
        }
        if (type === PaintCommonButtonsType.Visible) {
          currFill.visible = true
        }
        if (type === PaintCommonButtonsType.Hide) {
          currFill.visible = false
        }
        if (type === PaintCommonButtonsType.Delete) {
          prev.splice(index, 1)
        }
        return [...prev]
      })
    },
    []
  )

  return (
    <WorkspacePanel title="Fill" buttons={titleButtons} onClick={handleAddFill}>
      {fills.length &&
        fills.map((fill, index) => {
          if (fill.type !== 'SOLID') {
            return
          }
          return (
            <Row style={{ padding: '0 8px' }}>
              <Col span={28} className=" latte-workspace__paint-wrapper">
                <div className="latte-workspace__raw-component__borderFocusWithin">
                  <SolidColorPaint
                    data={fill}
                    onChange={handleFillChange.bind(null, index)}
                  />
                </div>
                <PaintCommonButtons
                  buttons={
                    fill.visible
                      ? paintCommonVisibleButtons
                      : paintCommonHideButtons
                  }
                  onClick={handleCommonButtonClick.bind(null, index)}
                />
              </Col>
            </Row>
          )
        })}
    </WorkspacePanel>
  )
}
