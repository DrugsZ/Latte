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
}

declare namespace latte.editor {
  /**
   * The version of the editor.
   */
  export const version: string

  export type SetStateAction<S> = S | ((prevState: S) => S)

  /**
   * The activeSelection of the editor.
   * This class can modify child elements one by one, and also update all children simultaneously.
   */
  export class Selection {
    /**
     * get x
     */

    x(): number | 'MIXED'

    /**
     * set x
     */

    move(newPosition: SetStateAction<vec2>): void

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

    /**
     * setFills
     */

    setFills(newFills: Paint[]): void
  }

  /**
   * Returns the selection of the editor.
   */
  export function getSelection(): Selection

  /**
   * Emitted when selection change
   */
  export type onDidSelectionChange = (
    listener: (e: readonly Selection) => void
  ) => void
}
