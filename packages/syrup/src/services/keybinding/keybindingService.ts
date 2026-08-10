import {
  Disposable,
  KeyCodeChord,
  ResolvedKeybinding,
  ResolvedKeybindingItem,
  toEmptyArrayIfContainsNull,
} from '@latte-js/kit'

import { StandardKeyboardEvent } from '../../dom/keyboardEvent'

import { KeybindingResolver, ResultKind } from './keybindingResolver'
import { KeybindingsRegistry } from './keybindingsRegistry'

import type { Keybinding } from '@latte-js/kit'
import type { IKeyboardEvent } from '../../dom/keyboardEvent'
import type { CommandService } from '../command/commandService'
import type { IInputService } from '../input/inputService'
import type { IKeybindingItem } from './keybindingsRegistry'

interface CurrentChord {
  keypress: string
  // label: string | null
}

export class KeybindingService extends Disposable {
  private _currentChords: CurrentChord[] = []
  private _cacheResolver: KeybindingResolver | null

  public get inChordMode(): boolean {
    return this._currentChords.length > 0
  }

  constructor(
    private _commandService: CommandService,
    private _inputService: IInputService
  ) {
    super()
    this._registerKeyListeners()
  }

  private _keyListener = (e: KeyboardEvent) => {
    const event = new StandardKeyboardEvent(e)
    this._dispatch(event)
  }

  private _registerKeyListeners() {
    this._register(this._inputService.onKeyDown(this._keyListener))
  }

  private _dispatch(event: IKeyboardEvent) {
    this._doDispatch(this.resolveKeyboardEvent(event))
  }

  private _leaveChordMode(): void {
    this._currentChords = []
  }

  private _doDispatch(userKeypress: ResolvedKeybinding) {
    const [userPressedChord] = userKeypress.getDispatchChords()
    const currentChords = this._currentChords.map(({ keypress }) => keypress)
    if (userPressedChord === null) {
      return
    }
    const resolveResult = this._getResolver().resolve(
      currentChords,
      userPressedChord
    )
    switch (resolveResult.kind) {
      case ResultKind.NoMatchingKb: {
        if (this.inChordMode) {
          this._leaveChordMode()
        }
        return false
      }

      case ResultKind.MoreChordsNeeded: {
        this._currentChords.push({ keypress: userPressedChord })
        return false
      }

      case ResultKind.KbFound: {
        if (
          resolveResult.commandId === null ||
          resolveResult.commandId === ''
        ) {
          if (this.inChordMode) {
            this._leaveChordMode()
          }
        } else {
          if (this.inChordMode) {
            this._leaveChordMode()
          }

          if (typeof resolveResult.commandArgs === 'undefined') {
            this._commandService
              .executeCommand(resolveResult.commandId)
              .then(undefined, console.error)
          } else {
            this._commandService
              .executeCommand(
                resolveResult.commandId,
                resolveResult.commandArgs
              )
              .then(undefined, console.error)
          }
        }

        return false
      }
    }
  }

  private _resolveChord(chord: KeyCodeChord | null): KeyCodeChord | null {
    if (!chord) return null
    const { ctrlKey, shiftKey, altKey, metaKey, keyCode } = chord
    return new KeyCodeChord(ctrlKey, shiftKey, altKey, metaKey, keyCode)
  }

  public resolveKeyboardEvent(e: IKeyboardEvent) {
    const { ctrlKey, shiftKey, altKey, metaKey, keyCode } = e
    const chord = new KeyCodeChord(ctrlKey, shiftKey, altKey, metaKey, keyCode)
    return new ResolvedKeybinding([chord])
  }

  private _resolveKeybindings(keybinding: Keybinding) {
    const chords: KeyCodeChord[] = toEmptyArrayIfContainsNull(
      keybinding.chords.map(chord => this._resolveChord(chord))
    )
    if (chords.length > 0) {
      return [new ResolvedKeybinding(chords)]
    }
    return []
  }

  private _resolveKeybindingItems(items: IKeybindingItem[]) {
    const result: ResolvedKeybindingItem[] = []
    let resultLen = 0
    items.forEach(item => {
      const { keybinding } = item
      let resolvedKeybindings: ResolvedKeybinding[] | [undefined] = [undefined]
      if (keybinding) {
        resolvedKeybindings = this._resolveKeybindings(keybinding)
      }
      resolvedKeybindings.forEach(resolvedKeybinding => {
        result[resultLen++] = new ResolvedKeybindingItem(
          resolvedKeybinding,
          item.command,
          item.commandArgs
        )
      })
    })
    return result
  }

  private _getResolver() {
    if (!this._cacheResolver) {
      const binds = this._resolveKeybindingItems(
        KeybindingsRegistry.getDefaultKeybindings()
      )
      this._cacheResolver = new KeybindingResolver(binds)
    }
    return this._cacheResolver
  }

  public override dispose(): void {
    this._cacheResolver = null
    super.dispose()
  }
}
