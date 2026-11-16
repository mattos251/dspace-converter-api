import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { ConvertDspaceFiles } from '../application/use-cases/ConvertDspaceFiles.js';
import { ConversionError } from '../domain/errors/ConversionError.js';
import { AppError } from '../domain/errors/AppError.js';
import { ZipArchiveService } from '../infrastructure/archive/ZipArchiveService.js';
import { PythonConversionEngine } from '../infrastructure/converters/PythonConversionEngine.js';
import { loggerOptions } from '../infrastructure/logger/logger.js';
import { LocalTemporaryStorage } from '../infrastructure/storage/LocalTemporaryStorage.js';
import { ConversionController } from '../presentation/http/controllers/ConversionController.js';
import { conversionRoutes } from '../presentation/http/routes/conversion.routes.js';
import { resolve } from 'node:path';

export function buildApp() {
  const maxFileSize = Number(process.env.MAX_FILE_SIZE_MB ?? 10) * 1024 * 1024;
  const app = Fastify({ logger: loggerOptions, bodyLimit: maxFileSize + 1024 * 1024 });
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((origin) => origin.trim());
  app.register(cors, { origin: allowedOrigins });
  app.register(multipart, { limits: { fileSize: maxFileSize, files: 1, fields: 0 } });

  const storage = new LocalTemporaryStorage();
  const engine = new PythonConversionEngine({
    pythonBin: process.env.PYTHON_BIN ?? (process.platform === 'win32' ? 'python' : 'python3'),
    scriptPath: resolve(process.cwd(), 'converter', 'main.py'),
    timeoutMs: Number(process.env.CONVERSION_TIMEOUT_MS ?? 60_000),
  });
  const useCase = new ConvertDspaceFiles(storage, engine, new ZipArchiveService());
  const controller = new ConversionController(useCase);

  app.get('/health', async () => ({ status: 'ok', service: 'dspace-converter-api' }));
  app.register(async (api) => {
    await conversionRoutes(api, controller);
  }, { prefix: '/api/v1' });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }
    if (error instanceof Error && 'statusCode' in error && (error as Record<string, unknown>).statusCode === 413) {
      return reply.status(413).send({ error: { code: 'FILE_TOO_LARGE', message: 'O arquivo excede o limite permitido.' } });
    }
    request.log.error({ err: error }, 'Erro não tratado na requisição');
    const fallback = new ConversionError('Ocorreu um erro interno durante a conversão.');
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: fallback.message } });
  });
  return app;
}
