import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CommandService } from '../commandService'
import { CommandsRegistry } from '../commandsRegistry'

describe('CommandService', () => {
  let commandService: CommandService

  beforeEach(() => {
    commandService = new CommandService()
  })

  it('should execute a registered command', async () => {
    const commandId = 'test.command'
    const handler = vi.fn().mockReturnValue('result')
    
    // Register command
    const dispose = CommandsRegistry.registerCommand(commandId, handler)
    
    try {
      const result = await commandService.executeCommand(commandId, 'arg1', 123)
      
      expect(handler).toHaveBeenCalledWith('arg1', 123)
      expect(result).toBe('result')
    } finally {
      dispose()
    }
  })

  it('should fail if command is not registered', async () => {
    await expect(commandService.executeCommand('non.existent.command'))
      .rejects.toThrow("command 'non.existent.command' not found")
  })

  it('should fire events before and after execution', async () => {
    const commandId = 'test.event'
    const handler = vi.fn()
    const dispose = CommandsRegistry.registerCommand(commandId, handler)
    
    const willExecuteSpy = vi.fn()
    const didExecuteSpy = vi.fn()
    
    commandService.onWillExecuteCommand(willExecuteSpy)
    commandService.onDidExecuteCommand(didExecuteSpy)
    
    try {
      await commandService.executeCommand(commandId, 'test')
      
      expect(willExecuteSpy).toHaveBeenCalledWith({
        commandId,
        args: ['test']
      })
      
      expect(didExecuteSpy).toHaveBeenCalledWith({
        commandId,
        args: ['test']
      })
      
      // Order check: will -> handler -> did
      expect(willExecuteSpy.mock.invocationCallOrder[0])
        .toBeLessThan(handler.mock.invocationCallOrder[0])
      
      expect(handler.mock.invocationCallOrder[0])
        .toBeLessThan(didExecuteSpy.mock.invocationCallOrder[0])
        
    } finally {
      dispose()
    }
  })
})
