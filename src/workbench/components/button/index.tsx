import type { MouseEventHandler, PropsWithChildren } from 'react'
import { useCallback, useState } from 'react'
import clsx from 'classnames'
import 'components/button/index.css'

export interface IconButtonProps {
  onClick?: MouseEventHandler
  selected?: boolean
}

export const IconButton = (props: PropsWithChildren<IconButtonProps>) => {
  const { onClick, selected } = props

  const [curSelected, setCurrentSelected] = useState(selected)

  const cls = clsx('raw-components__icon-button', {
    'raw-components__icon-button--selected': curSelected,
  })
  console.log(cls)

  const handleBlur = useCallback(() => {
    setCurrentSelected(false)
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      console.log(111)
      setCurrentSelected(!curSelected)
      onClick?.(e)
    },
    [curSelected]
  )

  return (
    <button onBlur={handleBlur} onClick={handleClick} className={cls}>
      {props.children}
    </button>
  )
}
