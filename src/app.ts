import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from './config.js';
import { ConvertDspaceFiles } from './conversion/ConvertDspaceFiles.js';
import { ZipArchiveService } from './adapters/ZipArchiveService.js';
import { PythonConversionEngine } from './adapters/PythonConversionEngine.js';
import { LocalTemporaryStorage } from './adapters/LocalTemporaryStorage.js';
import { createLoggerOptions } from './logger.js';
import { ConversionController } from './http/ConversionController.js';
import { conversionRoutes } from './http/conversion.routes.js';
import { handleError } from './http/error-handler.js';

export function buildApp(config: AppConfig) {
  const app = Fastify({
    logger: createLoggerOptions(config.logLevel),
    bodyLimit: config.maxFileSizeBytes + 1024 * 1024,
  });
  app.register(cors, { origin: config.corsOrigins });
  app.register(multipart, { limits: { fileSize: config.maxFileSizeBytes, files: 1, fields: 0 } });

  const engine = new PythonConversionEngine({
    pythonBin: config.pythonBin,
    scriptPath: fileURLToPath(new URL('../python/run_conversion.py', import.meta.url)),
    timeoutMs: config.conversionTimeoutMs,
    logger: app.log,
  });
  const useCase = new ConvertDspaceFiles(new LocalTemporaryStorage(), engine, new ZipArchiveService());
  const controller = new ConversionController(useCase);

  app.get('/health', async () => ({ status: 'ok', service: 'dspace-converter-api' }));
  app.register(async (api) => {
    await conversionRoutes(api, controller);
  }, { prefix: '/api/v1' });

  app.setErrorHandler(handleError);
  return app;
}
