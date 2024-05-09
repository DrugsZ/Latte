import type { ResolvedKeybindingItem } from 'Latte/common/keybindings'
import {
  KeybindingResolver,
  ResultKind,
} from 'Latte/services/keybinding/keybindingResolver'

describe('KeybindingResolver', () => {
  let resolver: KeybindingResolver
  let keybindings: ResolvedKeybindingItem[]

  beforeEach(() => {
    keybindings = [
      {
        command: 'command1',
        chords: ['a'],
        commandArgs: {},
        resolvedKeybinding: undefined,
      },
      {
        command: 'command2',
        chords: ['b', 'c', 'd'],
        commandArgs: {},
        resolvedKeybinding: undefined,
      },
      {
        command: 'command3',
        chords: ['b', 'c', 'e'],
        commandArgs: {},
        resolvedKeybinding: undefined,
      },
      {
        command: 'command4',
        chords: ['f', 'g'],
        commandArgs: {},
        resolvedKeybinding: undefined,
      },
      {
        command: 'command5',
        chords: ['f', 'g'],
        commandArgs: {},
        resolvedKeybinding: undefined,
      },
    ]
    resolver = new KeybindingResolver(keybindings)
  })

  test('should return NoMatchingKb when no keybinding is found', () => {
    const result = resolver.resolve([], 'h')
    expect(result).toEqual({ kind: ResultKind.NoMatchingKb })
  })

  test('should return MoreChordsNeeded when more chords are needed to match a keybinding', () => {
    const result = resolver.resolve(['b'], 'c')
    expect(result).toEqual({ kind: ResultKind.MoreChordsNeeded })
  })

  test('should return KbFound when a keybinding is found', () => {
    const result = resolver.resolve([], 'a')
    expect(result).toEqual({
      kind: ResultKind.KbFound,
      commandId: 'command1',
      commandArgs: {},
      resolvedKeybinding: undefined,
    })
  })

  test('should return MoreChordsNeeded when multiple keybindings match the same chords', () => {
    const result = resolver.resolve(['b'], 'c')
    expect(result).toEqual({ kind: ResultKind.MoreChordsNeeded })
  })

  test('should return the first matching keybinding when multiple keybindings match the same chords', () => {
    const result = resolver.resolve(['f'], 'g')
    expect(result).toEqual({
      kind: ResultKind.KbFound,
      commandId: 'command4',
      commandArgs: {},
      resolvedKeybinding: undefined,
    })
  })
})
