import type { MouseEventHandler, PropsWithChildren } from 'react'
import { useCallback } from 'react'
import 'components/button/index.css'

export interface IconButtonProps {
  onClick?: MouseEventHandler
  selected?: boolean
}

export const IconButton = (props: PropsWithChildren<IconButtonProps>) => {
  const { onClick, selected } = props

  const handleClick = useCallback((e: React.MouseEvent) => {
    onClick?.(e)
  }, [])

  return (
    <button onClick={handleClick} className="raw-components__icon-button">
      {props.children}
    </button>
  )
}
