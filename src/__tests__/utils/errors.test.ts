import { MTGError, ValidationError, APIError, GameStateError, RulesEngineError, handleError } from '../../utils/errors';
import { logger } from '../../utils/logger';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('Error classes', () => {
  describe('MTGError', () => {
    it('should create an MTGError with code and message', () => {
      const error = new MTGError('TEST_CODE', 'Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.name).toBe('MTGError');
    });

    it('should create an MTGError with details', () => {
      const details = { key: 'value' };
      const error = new MTGError('TEST_CODE', 'Test message', details);
      expect(error.details).toEqual(details);
    });

    it('should convert to ToolError format', () => {
      const error = new MTGError('TEST_CODE', 'Test message', { key: 'value' });
      const toolError = error.toToolError();
      
      expect(toolError).toEqual({
        error: {
          code: 'TEST_CODE',
          message: 'Test message',
          details: { key: 'value' },
        },
      });
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with correct code', () => {
      const error = new ValidationError('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('APIError', () => {
    it('should create an APIError with correct code', () => {
      const error = new APIError('API failed');
      expect(error.code).toBe('API_ERROR');
      expect(error.message).toBe('API failed');
      expect(error.name).toBe('APIError');
    });
  });

  describe('GameStateError', () => {
    it('should create a GameStateError with correct code', () => {
      const error = new GameStateError('Game state invalid');
      expect(error.code).toBe('GAME_STATE_ERROR');
      expect(error.message).toBe('Game state invalid');
      expect(error.name).toBe('GameStateError');
    });
  });

  describe('RulesEngineError', () => {
    it('should create a RulesEngineError with correct code', () => {
      const error = new RulesEngineError('Rules violation');
      expect(error.code).toBe('RULES_ENGINE_ERROR');
      expect(error.message).toBe('Rules violation');
      expect(error.name).toBe('RulesEngineError');
    });
  });
});

describe('handleError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle MTGError instances', () => {
    const error = new ValidationError('Test validation error');
    const result = handleError(error);
    
    expect(result).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Test validation error',
        details: undefined,
      },
    });
    expect(logger.error).toHaveBeenCalledWith('Error occurred', { error });
  });

  it('should handle standard Error instances', () => {
    const error = new Error('Standard error');
    error.stack = 'Error stack trace';
    const result = handleError(error);
    
    expect(result).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Standard error',
        details: { stack: 'Error stack trace' },
      },
    });
    expect(logger.error).toHaveBeenCalledWith('Error occurred', { error });
  });

  it('should handle unknown error types', () => {
    const error = 'String error';
    const result = handleError(error);
    
    expect(result).toEqual({
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        details: { error: 'String error' },
      },
    });
    expect(logger.error).toHaveBeenCalledWith('Error occurred', { error });
  });
});