import { useEffect, useState } from 'react'
import { NodeType } from '@latte-js/bean'
import type { EditableProperty, SelectedNodeProperties } from '@latte-js/crema'

interface PropertyFieldProps {
  label: string
  property: EditableProperty
  value: string
  disabled: boolean
  type?: 'text' | 'number'
  min?: number
  max?: number
  onCommit(property: EditableProperty, value: string): Promise<void>
}

function PropertyField({
  label,
  property,
  value,
  disabled,
  type = 'text',
  min,
  max,
  onCommit,
}: PropertyFieldProps) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const commit = async () => {
    if (draft === value) return
    try {
      await onCommit(property, draft)
    } catch {
      setDraft(value)
    }
  }

  return (
    <label className="property-field">
      <span>{label}</span>
      <input
        data-testid={`property-${property}`}
        type={type}
        step={type === 'number' ? 'any' : undefined}
        min={min}
        max={max}
        value={draft}
        disabled={disabled}
        onChange={event => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            setDraft(value)
            event.preventDefault()
          }
        }}
      />
    </label>
  )
}

export function PropertyPanel({
  selected,
  count,
  busy,
  onCommit,
}: {
  selected: SelectedNodeProperties | null
  count: number
  busy: boolean
  onCommit: (property: EditableProperty, value: string) => Promise<void>
}) {
  const format = (value: number) => String(Number(value.toFixed(4)))
  return (
    <aside className="sidebar-right" aria-label="Properties">
      <h2>Properties</h2>
      {!selected ? (
        <p>
          {count > 1
            ? 'Select one layer to edit its properties.'
            : 'Select a layer on the canvas.'}
        </p>
      ) : (
        <div key={selected.id}>
          <p className="layer-id" data-testid="selected-id">
            {selected.id}
          </p>
          <PropertyField
            label="Name"
            property="name"
            value={selected.name}
            disabled={busy}
            onCommit={onCommit}
          />
          <div className="property-grid">
            {(['x', 'y', 'width', 'height'] as const).map(property => (
              <PropertyField
                key={property}
                label={
                  property === 'x' || property === 'y'
                    ? `World ${property.toUpperCase()}`
                    : property === 'width'
                      ? 'Width'
                      : 'Height'
                }
                property={property}
                type="number"
                value={format(selected[property])}
                disabled={
                  busy ||
                  ((property === 'width' || property === 'height') &&
                    selected.type !== NodeType.RECTANGLE)
                }
                min={
                  property === 'width' || property === 'height'
                    ? 0.0001
                    : undefined
                }
                onCommit={onCommit}
              />
            ))}
          </div>
          <PropertyField
            label="Opacity (0–1)"
            property="opacity"
            type="number"
            min={0}
            max={1}
            value={format(selected.opacity)}
            disabled={busy}
            onCommit={onCommit}
          />
          <PropertyField
            label="Fill color"
            property="fill"
            value={selected.fill ?? ''}
            disabled={busy}
            onCommit={onCommit}
          />
          <p className="field-help">
            Use #RRGGBB to replace existing fills with a solid color.
          </p>
          <p className="field-help">
            Position uses world coordinates. Size uses the rectangle’s local
            dimensions. Press Enter or leave a field to apply.
          </p>
        </div>
      )}
    </aside>
  )
}
