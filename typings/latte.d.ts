interface Window {
	latte?: latte
}

declare namespace latte.editor{

  export enum OperateMode{
    ReadOnly,
    Edit,
    CreateNormalShape,
  }

  /**
	 * Emitted when operate mode change
	 */
	export function onDidOperateModeChange(listener: (e: readonly OperateMode) => void): void;

  /**
   * set cursor operate mode
   */
  export function setOperateMode(mode: OperateMode): void;
}