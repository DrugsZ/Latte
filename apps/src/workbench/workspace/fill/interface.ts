export type FillChangeHandler<T extends Paint = SolidColorPaint> = (
  newFill: T
) => void
