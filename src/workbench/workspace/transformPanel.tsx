import { WorkspacePanel } from 'workbench/workspace/workspacePanel'
import { Input } from 'workbench/components/input'
import { Row, Col } from 'workbench/components/row'
import { useCallback, useEffect, useState } from 'react'
import type { DisplayObject } from 'Latte/core/displayObject'

interface TransformPanelState {
  size: IPoint
  transform: IMatrixLike
}

interface TransformPanelProps {
  data: TransformPanelState
  onChange: (newState: TransformPanelState) => void
}

export const TransformPanel = (
  props: TransformPanelProps // const { size, transform } = props
) => {
  // const { x: width, y: height } = size
  // const { tx: left, ty: top } = transform

  const [left, setLeft] = useState<number>(0)
  const [top, setTop] = useState<number>(0)
  const [width, setWidth] = useState<number>(0)
  const [height, setHeight] = useState<number>(0)

  const handleSelectionChange = useCallback((e: DisplayObject) => {
    const { x, y, width, height } = e.OBB
    setLeft(x)
    setTop(y)
    setWidth(width)
    setHeight(height)
  }, [])

  useEffect(() => {
    setTimeout(() => {
      const rm = latte.editor.onDidSelectionChange(handleSelectionChange)
    }, 0)
  }, [])

  const handleTestInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const widget = latte.editor.getSelectionProxy()
      if (widget) {
        widget.move(pre => {
          pre.x = Number(e.target.value)
          return pre
        })
      }
    },
    []
  )

  return (
    <WorkspacePanel>
      {/* <RowComponent>
      <div className="displayContents">
        <Input prefix="x:" />
      </div>
      <div className="displayContents">y:</div>
    </RowComponent> */}
      <Row style={{ padding: '0 8px' }}>
        <Col span={12}>
          <Input
            className="latte-workspace__raw-component__borderFocusWithin"
            prefix="X"
            value={left}
            onBlur={handleTestInput}
          />
        </Col>
        <Col span={12}>
          <Input
            className="latte-workspace__raw-component__borderFocusWithin"
            prefix="Y"
            value={top}
          />
        </Col>
      </Row>
      <Row style={{ padding: '0 8px' }}>
        <Col span={12}>
          <Input
            className="latte-workspace__raw-component__borderFocusWithin"
            prefix="W"
            value={width}
          />
        </Col>
        <Col span={12}>
          <Input
            className="latte-workspace__raw-component__borderFocusWithin"
            prefix="H"
            value={height}
          />
        </Col>
      </Row>
    </WorkspacePanel>
  )
}
