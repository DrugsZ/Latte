interface Window {
  latte?: latte
}

declare namespace latte.editor {
  export enum OperateMode {
    ReadOnly,
    Edit,
    CreateNormalShape,
  }

  /**
   * Emitted when operate mode change
   */
  export function onDidOperateModeChange(
    listener: (e: readonly OperateMode) => void
  ): void

  /**
   * set cursor operate mode
   */
  export function setOperateMode(mode: OperateMode): void

  /**
   * Emitted when selection change
   */

  export function onDidSelectionChange(
    listener: (e: readonly DisplayObject) => void
  ): void

  export function getSelectionProxy(): ActiveSelectionProxyWidget

  export type SetStateAction<S> = S | ((prevState: S) => S)

  interface ActiveSelectionProxyWidget {
    /**
     * Emitted when selection change
     */
    onDidSelectionChange(listener: (e: readonly DisplayObject) => void): void

    /**
     * get x
     */

    x(): number | 'MIXED'

    /**
     * set x
     */

    setX(newX: SetStateAction<number>): void

    /**
     * get y
     */

    getY(): number[]

    /**
     * set y
     */

    setY(newY: SetStateAction<number>): void

    /**
     * get width
     */

    getWidth(): number[]

    /**
     * set width
     */

    setWidth(newWidth: SetStateAction<number[]>): void

    /**
     * get height
     */

    getHeight(): number[]

    /**
     * set height
     */

    setHeight(newHeight: SetStateAction<number[]>): void
  }
}
