/**
 * Lightweight namespaced logger. Debug logs are stripped in release builds.
 * Replace with a redacting/file-backed logger if we ever need audit trails —
 * but it must NEVER log embeddings or PII (privacy-by-design).
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, scope: string, args: unknown[]): void {
  if (level === 'debug' && !__DEV__) return;
  const tag = `[${scope}]`;
  if (level === 'debug') {
    console.log(tag, ...args);
  } else {
    console[level](tag, ...args);
  }
}

export const logger = {
  debug: (scope: string, ...args: unknown[]) => emit('debug', scope, args),
  info: (scope: string, ...args: unknown[]) => emit('info', scope, args),
  warn: (scope: string, ...args: unknown[]) => emit('warn', scope, args),
  error: (scope: string, ...args: unknown[]) => emit('error', scope, args),
};
