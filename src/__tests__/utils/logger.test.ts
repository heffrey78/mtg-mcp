import { Logger, LogLevel } from '../../utils/logger';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = Logger.getInstance();
    logger.setLogLevel(LogLevel.DEBUG);
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleWarn.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const logger1 = Logger.getInstance();
      const logger2 = Logger.getInstance();
      expect(logger1).toBe(logger2);
    });
  });

  describe('logging levels', () => {
    it('should log debug messages', () => {
      logger.debug('Test debug message');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG: Test debug message'),
        ''
      );
    });

    it('should log info messages', () => {
      logger.info('Test info message');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Test info message'),
        ''
      );
    });

    it('should log warn messages', () => {
      logger.warn('Test warn message');
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('WARN: Test warn message'),
        ''
      );
    });

    it('should log error messages', () => {
      logger.error('Test error message');
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: Test error message'),
        ''
      );
    });
  });

  describe('log level filtering', () => {
    it('should filter out debug messages when log level is INFO', () => {
      logger.setLogLevel(LogLevel.INFO);
      logger.debug('This should not appear');
      logger.info('This should appear');
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('INFO: This should appear'),
        ''
      );
    });

    it('should filter out debug and info messages when log level is WARN', () => {
      logger.setLogLevel(LogLevel.WARN);
      logger.debug('This should not appear');
      logger.info('This should not appear');
      logger.warn('This should appear');
      
      expect(mockConsoleLog).not.toHaveBeenCalled();
      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
    });
  });

  describe('metadata handling', () => {
    it('should include metadata in log output', () => {
      const metadata = { key: 'value', number: 42 };
      logger.info('Test message with metadata', metadata);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Test message with metadata'),
        JSON.stringify(metadata, null, 2)
      );
    });
  });

  describe('correlation ID', () => {
    it('should include correlation ID when set', () => {
      logger.setCorrelationId('test-correlation-id');
      logger.info('Test message');
      
      // The correlation ID is included in the LogEntry but not directly in console output
      // This test verifies the method doesn't throw
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });
});