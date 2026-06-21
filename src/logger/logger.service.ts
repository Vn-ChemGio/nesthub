import { Inject, Optional } from '@nestjs/common';
import { PINO_LOGGER } from './logger.constants.js';
import type { Logger as PinoLogger } from 'pino';

export class LoggerService {
  constructor(
    @Optional()
    @Inject(PINO_LOGGER)
    private readonly pinoLogger?: PinoLogger,
  ) {}

  fatal(message: unknown, ...args: unknown[]) {
    if (this.pinoLogger) {
      if (typeof message === 'string') {
        this.pinoLogger.fatal(message);
      } else {
        this.pinoLogger.fatal(message as Record<string, unknown>);
      }
    } else {
      console.error(message, ...args);
    }
  }

  error(message: unknown, ...args: unknown[]) {
    if (this.pinoLogger) {
      if (typeof message === 'string') {
        this.pinoLogger.error(message);
      } else {
        this.pinoLogger.error(message as Record<string, unknown>);
      }
    } else {
      console.error(message, ...args);
    }
  }

  warn(message: unknown, ...args: unknown[]) {
    if (this.pinoLogger) {
      if (typeof message === 'string') {
        this.pinoLogger.warn(message);
      } else {
        this.pinoLogger.warn(message as Record<string, unknown>);
      }
    } else {
      console.warn(message, ...args);
    }
  }

  info(message: unknown, ...args: unknown[]) {
    if (this.pinoLogger) {
      if (typeof message === 'string') {
        this.pinoLogger.info(message);
      } else {
        this.pinoLogger.info(message as Record<string, unknown>);
      }
    } else {
      console.log(message, ...args);
    }
  }

  debug(message: unknown, ...args: unknown[]) {
    if (this.pinoLogger) {
      if (typeof message === 'string') {
        this.pinoLogger.debug(message);
      } else {
        this.pinoLogger.debug(message as Record<string, unknown>);
      }
    } else {
      console.log(message, ...args);
    }
  }

  trace(message: unknown, ...args: unknown[]) {
    if (this.pinoLogger) {
      if (typeof message === 'string') {
        this.pinoLogger.trace(message);
      } else {
        this.pinoLogger.trace(message as Record<string, unknown>);
      }
    } else {
      console.log(message, ...args);
    }
  }

  child(bindings: Record<string, unknown>): LoggerService {
    if (!this.pinoLogger) return this;
    return LoggerService.fromPino(this.pinoLogger.child(bindings));
  }

  static fromPino(logger: PinoLogger): LoggerService {
    const instance = new LoggerService();
    (instance as unknown as { pinoLogger: PinoLogger }).pinoLogger = logger;
    return instance;
  }
}
