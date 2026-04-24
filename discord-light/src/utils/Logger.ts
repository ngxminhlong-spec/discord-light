import { format } from 'node:util';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export class Logger {
  #level: LogLevel;
  #prefix: string;

  constructor(level: LogLevel = LogLevel.INFO, prefix = 'DiscordLight') {
    this.#level = level;
    this.#prefix = prefix;
  }

  setLevel(level: LogLevel): void {
    this.#level = level;
  }

  error(message: string, ...args: unknown[]): void {
    if (this.#level >= LogLevel.ERROR) this.#write('ERROR', message, args, '\x1b[31m');
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.#level >= LogLevel.WARN) this.#write('WARN', message, args, '\x1b[33m');
  }

  info(message: string, ...args: unknown[]): void {
    if (this.#level >= LogLevel.INFO) this.#write('INFO', message, args, '\x1b[36m');
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.#level >= LogLevel.DEBUG) this.#write('DEBUG', message, args, '\x1b[90m');
  }

  #write(level: string, message: string, args: unknown[], color: string): void {
    const timestamp = new Date().toISOString();
    const formatted = args.length ? format(message, ...args) : message;
    const reset = '\x1b[0m';
    // eslint-disable-next-line no-console
    console.log(`${color}[${timestamp}] [${this.#prefix}] [${level}]${reset} ${formatted}`);
  }
}
