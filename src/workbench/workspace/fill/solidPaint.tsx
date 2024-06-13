import { Input } from 'workbench/components/input'
import type { ChangeEventHandler } from 'react'
import { useCallback } from 'react'
import type { FillChangeHandler } from 'workbench/workspace/fill/interface'

const rgbToHex = (fill: FillColor) => {
  const { r, g, b } = fill
  const outParts = [
    Math.ceil(r * 255).toString(16),
    Math.ceil(g * 255).toString(16),
    Math.ceil(b * 255).toString(16),
  ]

  // Pad single-digit output values
  outParts.forEach((part, i) => {
    if (part.length === 1) {
      outParts[i] = `0${part}`
    }
  })

  return outParts.join('')
}

const hexToRgb = hex => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : null
}

interface SolidPaintPreviewProps {
  fill: SolidColorPaint
}

const SolidPaintPreview = (props: SolidPaintPreviewProps) => {
  const { fill } = props
  const { color } = fill
  return (
    <div
      className="paint-preview"
      style={{
        backgroundColor: `rgba(${color.r * 255},${color.g * 255},${
          color.b * 255
        })`,
      }}
    />
  )
}

interface SolidPaintProps<T extends Paint = SolidColorPaint> {
  data: T
  onChange: FillChangeHandler<T>
}

export const SolidColorPaint = (props: SolidPaintProps) => {
  const { data, onChange } = props
  if (data.type !== 'SOLID') {
    return
  }

  const triggerChange = useCallback(
    value => {
      const newValue = value
      const rgbValue = hexToRgb(newValue)
      if (!rgbValue) {
        return
      }
      onChange?.({
        ...data,
        color: {
          ...rgbValue,
          a: data.color.a,
        },
      })
    },
    [data]
  )

  const handleBlur: ChangeEventHandler<HTMLInputElement> = useCallback(
    event => {
      triggerChange(event.target.value)
    },
    []
  )

  const handleEnterChange: React.KeyboardEventHandler<HTMLInputElement> =
    useCallback(event => {
      triggerChange((event.target as HTMLInputElement).value)
    }, [])
  return (
    <Input
      addonBefore={<SolidPaintPreview fill={data} />}
      onPressEnter={handleEnterChange}
      onBlur={handleBlur}
      addonAfter={
        <Input
          style={{ width: 48 }}
          value={(data.color.a / 1) * 100}
          className="latte-workspace__paint-panels--opacityInputContainer"
        />
      }
      value={rgbToHex(data.color)}
    />
  )
}
