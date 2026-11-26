export function createLoggerOptions(level: string) {
  return {
    level,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  };
}
