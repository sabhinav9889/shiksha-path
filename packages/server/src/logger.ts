/**
 * One line per request. Only the route, the outcome and the time: never names, emails, codes,
 * tokens, IPs or bodies (privacy rule). The edge entry writes the lines; tests read them.
 */
export interface LogEntry {
  route: string;
  status: number;
  code?: string;
  learnerId?: string;
  ms: number;
}

export interface Logger {
  info(entry: LogEntry): void;
  error(entry: LogEntry): void;
}

export interface MemoryLogger extends Logger {
  entries: (LogEntry & { level: 'info' | 'error' })[];
}

export function memoryLogger(): MemoryLogger {
  const entries: MemoryLogger['entries'] = [];
  return {
    entries,
    info: (entry) => entries.push({ level: 'info', ...entry }),
    error: (entry) => entries.push({ level: 'error', ...entry }),
  };
}

/** JSON lines for the function's log stream. */
export function jsonLogger(write: (line: string) => void): Logger {
  return {
    info: (entry) => write(JSON.stringify({ level: 'info', ...entry })),
    error: (entry) => write(JSON.stringify({ level: 'error', ...entry })),
  };
}
