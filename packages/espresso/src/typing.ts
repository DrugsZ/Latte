export interface IGraphObserver {
  update(
    id: string,
    key: string,
    oldValue: string | number,
    newValue: string | number
  ): void
}
