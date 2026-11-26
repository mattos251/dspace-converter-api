import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';

const boundary = 'test-boundary';
const apps: FastifyInstance[] = [];

function createApp(env: Record<string, string> = {}) {
  const app = buildApp(loadConfig({ LOG_LEVEL: 'silent', ...env }));
  apps.push(app);
  return app;
}

function multipartBody(filename: string, content: string): string {
  return [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    'Content-Type: text/xml',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

function uploadRequest(filename: string, content: string) {
  return {
    method: 'POST' as const,
    url: '/api/v1/conversions',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: multipartBody(filename, content),
  };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('API', () => {
  it('responde ao health check', async () => {
    const app = createApp();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'dspace-converter-api' });
  });

  it('retorna INVALID_FILE quando o nome do arquivo está errado', async () => {
    const app = createApp();

    const response = await app.inject(uploadRequest('outro.xml', '<input-forms />'));

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_FILE');
  });

  it('retorna FILE_TOO_LARGE quando o upload passa de MAX_FILE_SIZE_MB', async () => {
    const app = createApp({ MAX_FILE_SIZE_MB: '0.001' });
    const content = `<input-forms>${'x'.repeat(2000)}</input-forms>`;

    const response = await app.inject(uploadRequest('input-forms.xml', content));

    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('FILE_TOO_LARGE');
  });

  it('mantém o status 4xx de requisições mal formadas do Fastify', async () => {
    const app = createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/conversions',
      headers: { 'content-type': 'application/json' },
      payload: { file: 'nao-e-multipart' },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(500);
    expect(response.json().error.code).toBeDefined();
  });
});
