import type { Keybinding } from 'Latte/common/keybindings'
import {
  KeyCodeChord,
  ResolvedKeybinding,
  ResolvedKeybindingItem,
  toEmptyArrayIfContainsNull,
} from 'Latte/common/keybindings'
import type { CommandService } from 'Latte/core/commandService'
import * as dom from 'Latte/event/dom'
import type { IKeyboardEvent } from 'Latte/event/keyboardEvent'
import { StandardKeyboardEvent } from 'Latte/event/keyboardEvent'
import {
  KeybindingResolver,
  ResultKind,
} from 'Latte/services/keybinding/keybindingResolver'
import type { IKeybindingItem } from 'Latte/services/keybinding/keybindingsRegistry'
import { KeybindingsRegistry } from 'Latte/services/keybinding/keybindingsRegistry'

interface CurrentChord {
  keypress: string
  // label: string | null
}

export class KeybindingService {
  private _currentChords: CurrentChord[] = []
  private _cacheResolver: KeybindingResolver | null
  private _currentlyDispatchingCommandId: string | null

  public get inChordMode(): boolean {
    return this._currentChords.length > 0
  }

  constructor(private _commandService: CommandService) {
    this._registerKeyListeners()
    this._currentlyDispatchingCommandId = null
  }

  private _registerKeyListeners() {
    window.addEventListener(dom.EventType.KEY_DOWN, e => {
      const event = new StandardKeyboardEvent(e)
      this._dispatch(event)
    })
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
}
