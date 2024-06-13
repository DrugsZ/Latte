import type { PropsWithChildren } from 'react'

export const workspacePanel = (props: PropsWithChildren) => {
  const { children } = props
  return <div className="workspace-panel">{children}</div>
}

export const RowComponent = (props: PropsWithChildren) => {
  const { children } = props
  return <div className="row">{children}</div>
}
