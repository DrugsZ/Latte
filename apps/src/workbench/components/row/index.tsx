import 'workbench/components/row/index.css'
import type { PropsWithChildren } from 'react'
import clsx from 'classnames'

interface RowProps {
  style?: React.CSSProperties
  className?: string
}

export const Row = (props: PropsWithChildren<RowProps>) => {
  const { style, className } = props
  return (
    <div
      className={clsx(
        'latte-workspace__raw-components-row',
        'latte-workspace__raw-components--single-row',
        'latte-workspace__raw-components--single-row-height',
        className
      )}
      style={{ ...style }}
    >
      {props.children}
    </div>
  )
}

interface ColProps {
  span: number
  className?: string
}

export const Col = (props: PropsWithChildren<ColProps>) => {
  const { span, children, className } = props

  return (
    <div className={clsx(className)} style={{ gridColumnEnd: `span ${span}` }}>
      {children}
    </div>
  )
}
