#!/usr/bin/env node

import { MTGMCPServer } from './server.js';
import { logger, LogLevel } from './utils/logger.js';

async function main(): Promise<void> {
  // Set log level from environment variable or default to INFO
  const logLevel = process.env.LOG_LEVEL?.toUpperCase();
  if (logLevel && logLevel in LogLevel) {
    logger.setLogLevel(LogLevel[logLevel as keyof typeof LogLevel]);
  }

  const server = new MTGMCPServer();
  
  // Handle graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    process.exit(1);
  });

  try {
    logger.info('Starting MTG MCP Server...');
    await server.start();
    logger.info('MTG MCP Server is running and ready for connections');
  } catch (error) {
    logger.error('Failed to start MTG MCP Server', { error });
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Fatal error in main', { error });
    process.exit(1);
  });
}