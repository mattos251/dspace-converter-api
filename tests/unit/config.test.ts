import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
  it('usa os valores padrão quando nada está definido', () => {
    const config = loadConfig({});

    expect(config).toMatchObject({
      host: '0.0.0.0',
      port: 3000,
      maxFileSizeBytes: 10 * 1024 * 1024,
      conversionTimeoutMs: 60_000,
      corsOrigins: ['http://localhost:5173'],
      logLevel: 'info',
    });
  });

  it('lê os valores do ambiente', () => {
    const config = loadConfig({
      PORT: '4000',
      MAX_FILE_SIZE_MB: '2.5',
      CORS_ORIGIN: 'http://a.com, http://b.com',
      LOG_LEVEL: 'debug',
    });

    expect(config.port).toBe(4000);
    expect(config.maxFileSizeBytes).toBe(2.5 * 1024 * 1024);
    expect(config.corsOrigins).toEqual(['http://a.com', 'http://b.com']);
    expect(config.logLevel).toBe('debug');
  });

  it('recusa valores numéricos inválidos com o nome da variável', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow('PORT');
    expect(() => loadConfig({ MAX_FILE_SIZE_MB: '0' })).toThrow('MAX_FILE_SIZE_MB');
  });
});
