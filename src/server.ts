import 'dotenv/config.js';
import { buildApp } from './app.js';
import { loadConfig, type AppConfig } from './config.js';

let config: AppConfig;
try {
  config = loadConfig();
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exit(1);
}

const app = buildApp(config);

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`DSpace Converter API disponível em http://${config.host}:${config.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Encerrando aplicação');
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
