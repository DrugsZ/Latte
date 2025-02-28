import type { ResolvedKeybindingItem } from 'Latte/common/keybindings'

export const enum ResultKind {
  /** No keybinding found this sequence of chords */
  NoMatchingKb,

  /** There're several keybindings that have the given sequence of chords as a prefix */
  MoreChordsNeeded,

  /** A single keybinding found to be dispatched/invoked */
  KbFound,
}

export type ResolutionResult =
  | { kind: ResultKind.NoMatchingKb }
  | { kind: ResultKind.MoreChordsNeeded }
  | { kind: ResultKind.KbFound; commandId: string | null; commandArgs: any }

// util definitions to make working with the above types easier within this module:

export const NoMatchingKb: ResolutionResult = { kind: ResultKind.NoMatchingKb }
const MoreChordsNeeded: ResolutionResult = { kind: ResultKind.MoreChordsNeeded }
function KbFound(commandId: string | null, commandArgs: any): ResolutionResult {
  return { kind: ResultKind.KbFound, commandId, commandArgs }
}

export class KeybindingResolver {
  private _keybindings: ResolvedKeybindingItem[]
  private readonly _map: Map<
    /* 1st chord's keypress */ string,
    ResolvedKeybindingItem[]
  >
  private readonly _lookupMap: Map<
    /* commandId */ string,
    ResolvedKeybindingItem[]
  >

  constructor(binds: ResolvedKeybindingItem[]) {
    this._keybindings = binds
    this._map = new Map<string, ResolvedKeybindingItem[]>()
    this._lookupMap = new Map<string, ResolvedKeybindingItem[]>()
    for (let i = 0, len = this._keybindings.length; i < len; i++) {
      const k = this._keybindings[i]
      if (k.chords.length === 0) {
        // unbound
        continue
      }

      this._addKeyPress(k.chords[0], k)
    }
  }

  private _addKeyPress(keypress: string, item: ResolvedKeybindingItem): void {
    const conflicts = this._map.get(keypress)

    if (typeof conflicts === 'undefined') {
      // There is no conflict so far
      this._map.set(keypress, [item])
      this._addToLookupMap(item)
      return
    }

    for (let i = conflicts.length - 1; i >= 0; i--) {
      const conflict = conflicts[i]

      if (conflict.command === item.command) {
        continue
      }

      // Test if the shorter keybinding is a prefix of the longer one.
      // If the shorter keybinding is a prefix, it effectively will shadow the longer one and is considered a conflict.
      let isShorterKbPrefix = true
      for (
        let i = 1;
        i < conflict.chords.length && i < item.chords.length;
        i++
      ) {
        if (conflict.chords[i] !== item.chords[i]) {
          // The ith step does not conflict
          isShorterKbPrefix = false
          break
        }
      }
      if (!isShorterKbPrefix) {
        continue
      }
    }

    conflicts.push(item)
    this._addToLookupMap(item)
  }

  private _addToLookupMap(item: ResolvedKeybindingItem): void {
    if (!item.command) {
      return
    }

    let arr = this._lookupMap.get(item.command)
    if (typeof arr === 'undefined') {
      arr = [item]
      this._lookupMap.set(item.command, arr)
    } else {
      arr.push(item)
    }
  }

  public resolve(currentChords: string[], keypress: string): ResolutionResult {
    const pressedChords = [...currentChords, keypress]

    const kbCandidates = this._map.get(pressedChords[0])
    if (kbCandidates === undefined) {
      // No bindings with such 0-th chord
      return NoMatchingKb
    }

    let lookupMap: ResolvedKeybindingItem[] | null = null

    if (pressedChords.length < 2) {
      lookupMap = kbCandidates
    } else {
      // Fetch all chord bindings for `currentChords`
      lookupMap = []
      for (let i = 0, len = kbCandidates.length; i < len; i++) {
        const candidate = kbCandidates[i]

        if (pressedChords.length > candidate.chords.length) {
          // # of pressed chords can't be less than # of chords in a keybinding to invoke
          continue
        }

        let prefixMatches = true
        for (let i = 1; i < pressedChords.length; i++) {
          if (candidate.chords[i] !== pressedChords[i]) {
            prefixMatches = false
            break
          }
        }
        if (prefixMatches) {
          lookupMap.push(candidate)
        }
      }
    }

    if (!lookupMap.length) {
      return NoMatchingKb
    }

    const result = lookupMap[0]

    // check we got all chords necessary to be sure a particular keybinding needs to be invoked
    if (pressedChords.length < result.chords.length) {
      return MoreChordsNeeded
    }

    return KbFound(result.command, result.commandArgs)
  }
}
