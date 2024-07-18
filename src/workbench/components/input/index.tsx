import clsx from 'classnames'

import { useLayoutEffect, useState } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  FocusEventHandler,
  ChangeEventHandler,
  Dispatch,
  SetStateAction,
} from 'react'
import 'workbench/components/input/index.css'

export interface CommonInputProps {
  prefix?: ReactNode
  addonBefore?: ReactNode
  addonAfter?: ReactNode
}

interface InputProps
  extends CommonInputProps,
    Omit<
      InputHTMLAttributes<HTMLInputElement>,
      'size' | 'prefix' | 'type' | 'value'
    > {
  value: string | number
  onPressEnter?: React.KeyboardEventHandler<HTMLInputElement>
}

const hasValue = (value: any) => value !== undefined && value !== null

function useMergeState<T>(
  defaultValue: T,
  value: T
): [T, Dispatch<SetStateAction<T>>] {
  const [innerValue, setInnerValue] = useState(() =>
    hasValue(value) ? value : defaultValue
  )

  useLayoutEffect(() => {
    if (hasValue(value)) {
      setInnerValue(value)
    }
  }, [value])

  return [innerValue, setInnerValue]
}

export const Input = (props: InputProps) => {
  const {
    onChange,
    onFocus,
    onBlur,
    prefix,
    addonAfter,
    addonBefore,
    value,
    defaultValue,
    className,
    style,
    onPressEnter,
    onKeyDown,
    ...rest
  } = props

  const [currentValue, setCurrentValue] = useMergeState(defaultValue, value)

  const handleFocus: FocusEventHandler<HTMLInputElement> = e => {
    onFocus?.(e)
  }

  const handleBlur: FocusEventHandler<HTMLInputElement> = e => {
    onBlur?.(e)
  }

  const handleChange: ChangeEventHandler<HTMLInputElement> = e => {
    onChange?.(e)
    setCurrentValue(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (onPressEnter && e.key === 'Enter') {
      onPressEnter?.(e)
    }
    onKeyDown?.(e)
  }

  let element = (
    <input
      {...rest}
      className="latte-workspace__input"
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      value={currentValue}
    ></input>
  )

  if (prefix) {
    element = (
      <div className="displayContents">
        {prefix && (
          <div className="latte-workspace__input-prefix-wrapper">{prefix}</div>
        )}
        {element}
      </div>
    )
  }

  return (
    <div
      className={clsx('latte-workspace__input-wrapper', className)}
      style={{ ...style }}
    >
      {addonBefore && <div className="displayContents"> {addonBefore}</div>}
      {element}
      {addonAfter && <div className="displayContents">{addonAfter}</div>}
    </div>
  )
}
