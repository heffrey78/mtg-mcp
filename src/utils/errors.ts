import { ToolError } from '../types/index.js';
import { logger } from './logger.js';

export class MTGError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'MTGError';
    this.code = code;
    this.details = details;
  }

  public toToolError(): ToolError {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export class ValidationError extends MTGError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class APIError extends MTGError {
  constructor(message: string, details?: unknown) {
    super('API_ERROR', message, details);
    this.name = 'APIError';
  }
}

export class GameStateError extends MTGError {
  constructor(message: string, details?: unknown) {
    super('GAME_STATE_ERROR', message, details);
    this.name = 'GameStateError';
  }
}

export class RulesEngineError extends MTGError {
  constructor(message: string, details?: unknown) {
    super('RULES_ENGINE_ERROR', message, details);
    this.name = 'RulesEngineError';
  }
}

export function createErrorResponse(code: string, message: string, details?: unknown): ToolError {
  return {
    error: {
      code,
      message,
      details
    }
  };
}

export function handleError(error: unknown): ToolError {
  logger.error('Error occurred', { error });

  if (error instanceof MTGError) {
    return error.toToolError();
  }

  if (error instanceof Error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        details: { stack: error.stack },
      },
    };
  }

  return {
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      details: { error: String(error) },
    },
  };
}