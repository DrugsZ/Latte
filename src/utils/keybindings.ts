import { KeyCode, KeyCodeUtils } from 'Latte/utils/keyCodes'
import { illegalArgument } from 'Latte/utils/error'
import { OperatingSystem } from 'Latte/utils/platform'

const enum BinaryKeybindingsMask {
  CtrlCmd = (1 << 11) >>> 0,
  Shift = (1 << 10) >>> 0,
  Alt = (1 << 9) >>> 0,
  WinCtrl = (1 << 8) >>> 0,
  KeyCode = 0x000000ff,
}

export interface Modifiers {
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly metaKey: boolean
}

export class KeyCodeChord implements Modifiers {
  constructor(
    public readonly ctrlKey: boolean,
    public readonly shiftKey: boolean,
    public readonly altKey: boolean,
    public readonly metaKey: boolean,
    public readonly keyCode: KeyCode
  ) {}

  public equals(other: KeyCodeChord): boolean {
    return (
      other instanceof KeyCodeChord &&
      this.ctrlKey === other.ctrlKey &&
      this.shiftKey === other.shiftKey &&
      this.altKey === other.altKey &&
      this.metaKey === other.metaKey &&
      this.keyCode === other.keyCode
    )
  }

  public isModifierKey(): boolean {
    return (
      this.keyCode === KeyCode.Unknown ||
      this.keyCode === KeyCode.Ctrl ||
      this.keyCode === KeyCode.Meta ||
      this.keyCode === KeyCode.Alt ||
      this.keyCode === KeyCode.Shift
    )
  }
}

export class Keybinding {
  public readonly chords: KeyCodeChord[]

  constructor(chords: KeyCodeChord[]) {
    if (chords.length === 0) {
      throw illegalArgument(`chords`)
    }
    this.chords = chords
  }

  public equals(other: Keybinding | null): boolean {
    if (other === null) {
      return false
    }
    if (this.chords.length !== other.chords.length) {
      return false
    }
    for (let i = 0; i < this.chords.length; i++) {
      if (!this.chords[i].equals(other.chords[i])) {
        return false
      }
    }
    return true
  }
}

export function createSimpleKeybinding(
  keybinding: number,
  OS: OperatingSystem
): KeyCodeChord {
  const ctrlCmd = !!(keybinding & BinaryKeybindingsMask.CtrlCmd)
  const winCtrl = !!(keybinding & BinaryKeybindingsMask.WinCtrl)

  const ctrlKey = OS === OperatingSystem.Macintosh ? winCtrl : ctrlCmd
  const shiftKey = !!(keybinding & BinaryKeybindingsMask.Shift)
  const altKey = !!(keybinding & BinaryKeybindingsMask.Alt)
  const metaKey = OS === OperatingSystem.Macintosh ? ctrlCmd : winCtrl
  const keyCode = keybinding & BinaryKeybindingsMask.KeyCode

  return new KeyCodeChord(ctrlKey, shiftKey, altKey, metaKey, keyCode)
}

export function decodeKeybinding(
  keybinding: number | number[],
  OS: OperatingSystem
): Keybinding | null {
  if (typeof keybinding === 'number') {
    if (keybinding === 0) {
      return null
    }
    const firstChord = (keybinding & 0x0000ffff) >>> 0
    const secondChord = (keybinding & 0xffff0000) >>> 16
    if (secondChord !== 0) {
      return new Keybinding([
        createSimpleKeybinding(firstChord, OS),
        createSimpleKeybinding(secondChord, OS),
      ])
    }
    return new Keybinding([createSimpleKeybinding(firstChord, OS)])
  }
  const chords: KeyCodeChord[] = []
  for (let i = 0; i < keybinding.length; i++) {
    chords.push(createSimpleKeybinding(keybinding[i], OS))
  }
  return new Keybinding(chords)
}

export class ResolvedKeybinding {
  private _chords: KeyCodeChord[]
  constructor(chords: KeyCodeChord[]) {
    this._chords = chords
  }
  getDispatchChords() {
    return this._chords.map(keyChord => this._getDispatchChord(keyChord))
  }
  private _getDispatchChord(chord: KeyCodeChord) {
    if (chord.isModifierKey()) {
      return null
    }
    let result = ''

    if (chord.ctrlKey) {
      result += 'ctrl+'
    }
    if (chord.shiftKey) {
      result += 'shift+'
    }
    if (chord.altKey) {
      result += 'alt+'
    }
    if (chord.metaKey) {
      result += 'meta+'
    }
    result += KeyCodeUtils.toString(chord.keyCode)

    return result
  }
}

export function toEmptyArrayIfContainsNull<T>(arr: (T | null)[]): T[] {
  const result: T[] = []
  for (let i = 0, len = arr.length; i < len; i++) {
    const element = arr[i]
    if (!element) {
      return []
    }
    result.push(element)
  }
  return result
}

export class ResolvedKeybindingItem {
  public readonly resolvedKeybinding: ResolvedKeybinding | undefined
  public readonly chords: string[]
  public readonly command: string | null
  public readonly commandArgs: any

  constructor(
    resolvedKeybinding: ResolvedKeybinding | undefined,
    command: string | null,
    commandArgs: any
  ) {
    this.resolvedKeybinding = resolvedKeybinding
    this.chords = resolvedKeybinding
      ? toEmptyArrayIfContainsNull(resolvedKeybinding.getDispatchChords())
      : []
    this.command = command
    this.commandArgs = commandArgs
  }
}
