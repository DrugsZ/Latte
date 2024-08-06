import type { PropsWithChildren, ReactNode } from 'react'
import { useCallback } from 'react'
import 'workbench/workspace/workspace.css'
import { Row, Col } from 'workbench/components/row'
import clsx from 'classnames'
import { IconButton } from 'components/button'

export interface WorkspacePanelIconButton<T extends any = any> {
  icon: ReactNode
  type: T
}

interface PaintCommonButtonsProps<T extends any = any> {
  buttons?: WorkspacePanelIconButton<T>[]
  onClick?: (type: T) => void
}

export const PaintCommonButtons = (
  props: PropsWithChildren<PaintCommonButtonsProps>
) => {
  const { buttons, onClick } = props

  const handleClick = useCallback(
    (button: WorkspacePanelIconButton) => {
      const { type } = button
      onClick?.(type)
    },
    [onClick]
  )
  if (!buttons || !buttons.length) {
    return
  }
  return (
    <div className="displayContents">
      {buttons.map(button => (
        <IconButton onClick={handleClick.bind(null, button)}>
          {button.icon}
        </IconButton>
      ))}
    </div>
  )
}

interface WorkspacePanelTitleProps<T extends any = any> {
  buttons?: WorkspacePanelIconButton<T>[]
  onClick?: (buttonType: T) => void
}

const WorkspacePanelTitle = (
  props: PropsWithChildren<WorkspacePanelTitleProps>
) => {
  const { children, ...rest } = props

  return (
    <div className="latte-workspace-panel__title-wrapper">
      <div className="latte-workspace-panel__title">{children}</div>
      <PaintCommonButtons {...rest} />
    </div>
  )
}

interface WorkspacePanelProps extends WorkspacePanelTitleProps {
  title: ReactNode
}

export const WorkspacePanel = (
  props: PropsWithChildren<WorkspacePanelProps>
) => {
  const { children, title, buttons, onClick: onButtonClick } = props
  const cls = clsx('latte-workspace-panel', {
    'latte-workspace-panel--empty': !!children,
  })
  return (
    <div className={cls}>
      {title && (
        <Row style={{ padding: '0 8px' }}>
          <Col span={28}>
            {
              <WorkspacePanelTitle buttons={buttons} onClick={onButtonClick}>
                {title}
              </WorkspacePanelTitle>
            }
          </Col>
        </Row>
      )}
      {children}
    </div>
  )
}
