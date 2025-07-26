import { MTGMCPServer } from '../server';
import { logger } from '../utils/logger';

// Mock the logger to avoid console output during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('MTGMCPServer', () => {
  let server: MTGMCPServer;

  beforeEach(() => {
    server = new MTGMCPServer();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (server.isServerRunning()) {
      await server.stop();
    }
  });

  describe('constructor', () => {
    it('should create a server instance', () => {
      expect(server).toBeInstanceOf(MTGMCPServer);
      expect(server.isServerRunning()).toBe(false);
    });
  });

  describe('isServerRunning', () => {
    it('should return false initially', () => {
      expect(server.isServerRunning()).toBe(false);
    });
  });

  describe('logging', () => {
    it('should have logger available', () => {
      // Logger is available for use
      expect(logger.info).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });
  });

  describe('server state', () => {
    it('should maintain correct running state', () => {
      expect(server.isServerRunning()).toBe(false);
    });
  });
});