export enum LogLevel {
  DEBUG = 0,
  INFO = 1, 
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private correlationId?: string;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  public debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(this.correlationId ? { correlationId: this.correlationId } : {}),
      ...(metadata ? { metadata } : {}),
    };

    const levelName = LogLevel[level];
    const output = `[${entry.timestamp}] ${levelName}: ${message}`;
    
    if (level >= LogLevel.ERROR) {
      console.error(output, metadata ? JSON.stringify(metadata, null, 2) : '');
    } else if (level >= LogLevel.WARN) {
      console.warn(output, metadata ? JSON.stringify(metadata, null, 2) : '');
    } else {
      console.log(output, metadata ? JSON.stringify(metadata, null, 2) : '');
    }
  }
}

export const logger = Logger.getInstance();