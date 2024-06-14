import type { PropsWithChildren, ReactNode } from 'react'
import 'workbench/workspace/workspace.css'
import { Row, Col } from 'workbench/components/row'
import clsx from 'classnames'
import { IconButton } from 'components/button'

interface WorkspacePanelTitleButton<T extends any = any> {
  icon: ReactNode
  type: T
}

interface WorkspacePanelTitleProps<T extends any = any> {
  buttons?: WorkspacePanelTitleButton<T>[]
  onButtonClick?: (buttonType: T) => void
}

const WorkspacePanelTitle = (
  props: PropsWithChildren<WorkspacePanelTitleProps>
) => {
  const { children, buttons, onButtonClick: onClick } = props

  const handleClick = (button: WorkspacePanelTitleButton) => {
    const { type } = button
    onClick?.(type)
  }

  return (
    <div className="latte-workspace-panel__title-wrapper">
      <div className="latte-workspace-panel__title">{children}</div>
      {buttons && buttons.length > 0 && (
        <div className="displayContents">
          {buttons.map(button => (
            <IconButton onClick={handleClick.bind(button)}>
              {button.icon}
            </IconButton>
          ))}
        </div>
      )}
    </div>
  )
}

interface WorkspacePanelProps extends WorkspacePanelTitleProps {
  title: ReactNode
}

export const WorkspacePanel = (
  props: PropsWithChildren<WorkspacePanelProps>
) => {
  const { children, title, buttons, onButtonClick } = props
  const cls = clsx('latte-workspace-panel', {
    'latte-workspace-panel--empty': !!children,
  })
  return (
    <div className={cls}>
      {title && (
        <Row style={{ padding: '0 8px' }}>
          <Col span={28}>
            {
              <WorkspacePanelTitle
                buttons={buttons}
                onButtonClick={onButtonClick}
              >
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
