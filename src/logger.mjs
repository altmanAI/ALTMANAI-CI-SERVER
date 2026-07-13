const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger({ level = 'info', sink = console } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  function write(logLevel, message, fields = {}) {
    if (LEVELS[logLevel] < threshold) return;
    const record = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      message,
      ...fields
    };
    const output = JSON.stringify(record);
    const method = logLevel === 'error' ? 'error' : logLevel === 'warn' ? 'warn' : 'log';
    sink[method](output);
  }

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields)
  };
}
