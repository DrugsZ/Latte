import type { Keybinding } from 'Latte/utils/keybindings'
import {
  KeyCodeChord,
  ResolvedKeybinding,
  ResolvedKeybindingItem,
  toEmptyArrayIfContainsNull,
} from 'Latte/utils/keybindings'
import type { CommandService } from 'Latte/core/services/command/commandService'
import * as dom from 'Latte/core/dom/dom'
import type { IKeyboardEvent } from 'Latte/core/dom/keyboardEvent'
import { StandardKeyboardEvent } from 'Latte/core/dom/keyboardEvent'
import {
  KeybindingResolver,
  ResultKind,
} from 'Latte/core/services/keybinding/keybindingResolver'
import type { IKeybindingItem } from 'Latte/core/services/keybinding/keybindingsRegistry'
import { KeybindingsRegistry } from 'Latte/core/services/keybinding/keybindingsRegistry'
import { Disposable } from 'Latte/core/services/lifecycle/lifecycleService'

interface CurrentChord {
  keypress: string
  // label: string | null
}

export class KeybindingService extends Disposable {
  private _currentChords: CurrentChord[] = []
  private _cacheResolver: KeybindingResolver | null
  private _currentlyDispatchingCommandId: string | null

  public get inChordMode(): boolean {
    return this._currentChords.length > 0
  }

  constructor(private _commandService: CommandService) {
    super()
    this._registerKeyListeners()
    this._currentlyDispatchingCommandId = null
  }

  private _keyListener = (e: KeyboardEvent) => {
    const event = new StandardKeyboardEvent(e)
    this._dispatch(event)
  }

  private _registerKeyListeners() {
    window.addEventListener(dom.EventType.KEY_DOWN, this._keyListener)
  }

  private _dispatch(event: IKeyboardEvent) {
    this._doDispatch(this.resolveKeyboardEvent(event))
  }

  private _leaveChordMode(): void {
    this._currentChords = []
  }

  private _doDispatch(userKeypress: ResolvedKeybinding) {
    let userPressedChord: string | null = null
    let currentChords: string[] | null = null
    ;[userPressedChord] = userKeypress.getDispatchChords()
    currentChords = this._currentChords.map(({ keypress }) => keypress)
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

          this._currentlyDispatchingCommandId = resolveResult.commandId
          try {
            if (typeof resolveResult.commandArgs === 'undefined') {
              this._commandService
                .executeCommand(resolveResult.commandId)
                .then(undefined, err => console.error)
            } else {
              this._commandService
                .executeCommand(
                  resolveResult.commandId,
                  resolveResult.commandArgs
                )
                .then(undefined, console.error)
            }
          } finally {
            this._currentlyDispatchingCommandId = null
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
    window.removeEventListener(dom.EventType.KEY_DOWN, this._keyListener)
    super.dispose()
  }
}
