const MB = 1024 * 1024;

export interface AppConfig {
  host: string;
  port: number;
  pythonBin: string;
  maxFileSizeBytes: number;
  conversionTimeoutMs: number;
  corsOrigins: string[];
  logLevel: string;
}

// Lê e valida todas as variáveis de ambiente de uma vez, na inicialização
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    host: env.HOST ?? '0.0.0.0',
    port: positiveNumber(env, 'PORT', 3000),
    pythonBin: env.PYTHON_BIN ?? (process.platform === 'win32' ? 'python' : 'python3'),
    maxFileSizeBytes: Math.floor(positiveNumber(env, 'MAX_FILE_SIZE_MB', 10) * MB),
    conversionTimeoutMs: positiveNumber(env, 'CONVERSION_TIMEOUT_MS', 60_000),
    corsOrigins: (env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}

function positiveNumber(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Variável ${name} inválida: "${raw}". Informe um número maior que zero.`);
  }
  return value;
}
